window.AnimatedDoughnut = {};

// Sets up the segment class
(function setupSegmentClass() {

  var Segment = function(doughnut, index) {
    var segment = this;

    segment.doughnut = doughnut;
    segment.index = index;
    segment.drawComplete = false;
    segment.init();
  };


  Segment.prototype.init = function() {
    var segment = this;

    segment.data = segment.doughnut.data.data[segment.index];
    segment.label = segment.data.label || '';
    segment.value = segment.data.value;
    segment.animationDuration = ( segment.value / segment.doughnut.data.total ) * segment.doughnut.options.animationDuration;
    segment.animationProgress = 0;

    segment.arcStart = ( segment.index == 0 ) ? 1.5 * Math.PI : segment.doughnut.segments[segment.index - 1].arcEnd;
    segment.arcCenter = segment.arcStart + (2 * Math.PI * (( segment.value / 2 ) / segment.doughnut.data.total));
    segment.arcEnd = segment.arcStart + (2 * Math.PI * (segment.value / segment.doughnut.data.total));
  };


  Segment.prototype.update = function() {
    var segment = this,
        doughnut = segment.doughnut;

    if ( segment.index == 0 || doughnut.segments[segment.index - 1].drawComplete )
    {
      // Set the start time if not set
      if ( segment.startTime == null )
        segment.startTime = doughnut.time;

      segment.animationProgress = AnimatedDoughnut.EasingFunctions.easeInCubic(( doughnut.time - segment.startTime ) / segment.animationDuration);
      // segment.animationProgress = easeIn(doughnut.time - segment.startTime, segment.animationProgress, 1 - segment.animationProgress, segment.animationDuration);

      // Make sure max of 1 set for animation progress
      if ( segment.animationProgress > 1 )
        segment.animationProgress = 1;
    }
  };


  Segment.prototype.draw = function() {
    var segment = this,
        doughnut = segment.doughnut,
        ctx = doughnut.ctx,
        currentArcEnd = segment.arcStart + ( 2 * Math.PI * (segment.value / doughnut.data.total) * segment.animationProgress );

    ctx.moveTo(doughnut.centerX, doughnut.centerY);
    ctx.beginPath();
    ctx.arc(doughnut.centerX, doughnut.centerY, doughnut.outerRadius, segment.arcStart, currentArcEnd, false);
    ctx.lineTo(doughnut.centerX, doughnut.centerY);
    ctx.fillStyle = segment.data.color;
    ctx.closePath();
    ctx.fill();

    if ( currentArcEnd == segment.arcEnd )
      segment.drawComplete = true;

    if ( doughnut.options.hollowPercentage > 0 )
      doughnut.hollowOut();

    if ( doughnut.options.legendBar.width > 0 && segment.drawComplete )
      segment.drawLegendBarLabel();
  };


  Segment.prototype.drawLegendBarLabel = function() {
    var segment = this,
        doughnut = segment.doughnut,
        ctx = doughnut.ctx;

    // Some calculations first
    spotCenterX = doughnut.centerX + doughnut.legendBarRadius * Math.cos(segment.arcCenter);
    spotCenterY = doughnut.centerY + doughnut.legendBarRadius * Math.sin(segment.arcCenter);
    segmentCenterX = doughnut.centerX + doughnut.outerRadius * Math.cos(segment.arcCenter);
    segmentCenterY = doughnut.centerY + doughnut.outerRadius * Math.sin(segment.arcCenter);

    // Line to legend bar
    ctx.beginPath();
    ctx.moveTo(segmentCenterX, segmentCenterY);
    ctx.lineTo(spotCenterX, spotCenterY);
    ctx.strokeStyle = segment.data.color;
    ctx.stroke();

    // Coloured spot on legend bar
    ctx.beginPath();
    ctx.arc(spotCenterX, spotCenterY, doughnut.options.legendBar.spotRadius, 0, 2 * Math.PI, false);
    ctx.fillStyle = segment.data.color;
    ctx.fill();

    // Text label
    ctx.beginPath();
    ctx.font = 'normal normal ' + doughnut.options.font.weight + ' ' + doughnut.options.font.size + 'px ' + doughnut.options.font.family;
    ctx.fillStyle = doughnut.options.font.color;
    ctx.textBaseline = 'middle';

    if ( segment.arcCenter >= ( Math.PI * 2.5 ) && segment.arcCenter <= ( Math.PI * 3.5 ) ) { // left
      textAlign = 'right';
      textStartX = spotCenterX - ( 2 * doughnut.options.legendBar.spotRadius );
      textStartY = spotCenterY;

      if ( segment.arcCenter <= ( Math.PI * 2.833 ) )
        textStartY = spotCenterY + ( 2 * doughnut.options.legendBar.spotRadius );
      else if ( segment.arcCenter >= ( Math.PI * 3.167 ) )
        textStartY = spotCenterY - ( 2 * doughnut.options.legendBar.spotRadius );
    }
    else { // right
      textAlign = 'left';
      textStartX = spotCenterX + ( doughnut.options.legendBar.spotRadius * 3.5 );
      textStartY = spotCenterY;

      if ( segment.arcCenter <= ( Math.PI * 0.833 ) )
        textStartY = spotCenterY + ( 2 * doughnut.options.legendBar.spotRadius );
      else if ( segment.arcCenter >= ( Math.PI * 2.167 ) )
        textStartY = spotCenterY - ( 2 * doughnut.options.legendBar.spotRadius );
    }

    ctx.textAlign = textAlign;
    var labelLines = segment.label.split(' ');
    for ( var i=0; i<labelLines.length; i++ ) {
      ctx.fillText(labelLines[i], textStartX, (i * doughnut.options.font.size) + textStartY);
    }
  };

  AnimatedDoughnut.Segment = Segment;
})();


// Sets up the doughnut class
(function setupDoughnutClass() {
  var Doughnut = function(elem, options) {
    var doughnut = this;
    doughnut.elem = doughnut.canvas = elem;
    doughnut.options = AnimatedDoughnut.apiDefaults.extend(options || {});
    doughnut.ctx = doughnut.canvas.getContext('2d');
    doughnut.data = new AnimatedDoughnut.DataHelper(doughnut.options.data);
    doughnut.visible = false;

    // TODO - visibility trigger on scroll

    // Re-init trigger on resize
    window.addEventListener('resize', function resizeHandler() {
      doughnut.clearCanvas();
      doughnut.init();
    });

    doughnut.init();
  };


  Doughnut.prototype.init = function() {
    var doughnut = this;

    doughnut.animating = false;
    doughnut.animationComplete = false;
    doughnut.segments = [];

    // Set up the width & height
    doughnut.width = doughnut.height = doughnut.elem.parentNode.offsetHeight;
    doughnut.elem.width = doughnut.width;
    doughnut.elem.height = doughnut.height;

    // Set center and radius vars up
    doughnut.centerX = doughnut.width / 2;
    doughnut.centerY = doughnut.height / 2;
    padding = doughnut.options.padding + ( 2 * doughnut.options.legendBar.width );

    if ( doughnut.width < doughnut.height )
      doughnut.legendBarRadius = ( doughnut.width - padding ) / 2;
    else
      doughnut.legendBarRadius = ( doughnut.height - padding ) / 2;

    doughnut.outerRadius = doughnut.legendBarRadius - ( ( doughnut.options.legendBar.distancePercentage / 100 ) * doughnut.legendBarRadius );
    doughnut.hollowRadius = ( doughnut.options.hollowPercentage / 100) * doughnut.outerRadius;

    // Set segments up
    for ( var i=0; i<doughnut.data.data.length; i++ ) {
      doughnut.segments.push(new AnimatedDoughnut.Segment(doughnut, i));
    };

    // Set background up
    if ( doughnut.elem.dataset.background )
      doughnut.setupBackground();

    // Re-calculate image pos
    if ( doughnut.img )
      doughnut.calculateImagePosition(doughnut.img.img);

    // Draw the legend bar
    doughnut.clearCanvas();

    if ( doughnut.options.legendBar.width > 0 )
      doughnut.drawLegendBar();

    // Animate!
    if ( doughnut.options.autostart || doughnut.visible )
      setTimeout(function() { doughnut.animate(); }, 50);
  };


  Doughnut.prototype.setupBackground = function() {
    var doughnut = this,
        img = new Image();

    img.onload = function() {
      doughnut.calculateImagePosition(img);
    };
    img.src = doughnut.elem.dataset.background;
  };


  Doughnut.prototype.calculateImagePosition = function(img) {
    var doughnut = this;

    // Calculate the positioning and sizing of the image within the donut center
    var c = Math.atan2(-doughnut.hollowRadius, -doughnut.hollowRadius),
        x = doughnut.centerX + Math.floor( doughnut.hollowRadius * Math.cos(c) ),
        y = doughnut.centerY + Math.floor( doughnut.hollowRadius * Math.sin(c) ),
        c2 = Math.atan2(-doughnut.hollowRadius, doughnut.hollowRadius),
        x2 = doughnut.centerX + Math.floor( doughnut.hollowRadius * Math.cos(c2) );
        maxSize = x2 - x;

    doughnut.img = {
      img: img
    };

    if ( img.width > img.height )
    {
      img.width = maxSize;
      img.height = ( img.height / img.width ) * maxSize;
      img.x = x;
      img.y = y + ( ( maxSize - ( ( img.height / img.width ) * maxSize ) ) / 2);
    }
    else
    {
      img.width = ( img.width / img.height ) * maxSize;
      img.height = maxSize;
      img.x = x + ( ( maxSize - ( ( img.width / img.height ) * maxSize ) ) / 2);
      img.y = y;
    }
  };


  Doughnut.prototype.animate = function() {
    var doughnut = this;

    // Set state to animating
    doughnut.animating = true;

    // Update progress vars
    doughnut.update();

    // Clear the canvas then draw again
    doughnut.clearCanvas();
    doughnut.draw();

    doughnut.repeater = AnimatedDoughnut.requestAnimationFrame.call(window, function() {
      var animationComplete = true;

      doughnut.segments.forEach(function(segment) {
        if ( !segment.drawComplete )
          animationComplete = false;
      });

      if ( animationComplete )
      {
        doughnut.animating = false;
        doughnut.animationComplete = true;
      }
      else
        doughnut.animate();
    });
  };


  Doughnut.prototype.update = function() {
    var doughnut = this;

    doughnut.time = (new Date).getTime();

    if ( doughnut.startTime == null )
      doughnut.startTime = doughnut.time;

    // Calculate progress through animation
    doughnut.animationProgress = ( doughnut.time - doughnut.startTime ) / doughnut.options.animationDuration;

    // Make sure max of 1 set for animation progress
    if ( doughnut.animationProgress > 1 )
      doughnut.animationProgress = 1;

    // Loop over segments and update their information too
    doughnut.segments.forEach(function(segment) {
      segment.update();
    });
  };


  Doughnut.prototype.draw = function() {
    var doughnut = this;

    // Draw the legend bar
    if ( doughnut.options.legendBar.width > 0 )
      doughnut.drawLegendBar();

    doughnut.segments.forEach(function(segment, index) {
      if ( index === 0 || doughnut.segments[index - 1].drawComplete )
        segment.draw();
    });
  };


  Doughnut.prototype.clearCanvas = function() {
    var doughnut = this;

    doughnut.ctx.clearRect(0, 0, doughnut.width, doughnut.height);
  };


  Doughnut.prototype.drawLegendBar = function() {
    var doughnut = this;

    doughnut.ctx.moveTo(doughnut.centerX, doughnut.centerY);
    doughnut.ctx.beginPath();
    doughnut.ctx.arc(doughnut.centerX, doughnut.centerY, doughnut.legendBarRadius, 0, 2 * Math.PI, false);
    doughnut.ctx.lineWidth = doughnut.options.legendBar.width;
    doughnut.ctx.strokeStyle = doughnut.options.legendBar.style;
    doughnut.ctx.stroke();

    // Add the image on top
    if ( doughnut.img )
      doughnut.ctx.drawImage(doughnut.img.img, doughnut.img.x, doughnut.img.y, doughnut.img.width, doughnut.img.height);
  };


  Doughnut.prototype.hollowOut = function() {
    var doughnut = this;

    // Hollow
    doughnut.ctx.moveTo(doughnut.centerX, doughnut.centerY);
    doughnut.ctx.beginPath();
    doughnut.ctx.arc(doughnut.centerX, doughnut.centerY, doughnut.hollowRadius, 0, 2 * Math.PI, false);
    doughnut.ctx.fillStyle = '#f8f8f8';
    doughnut.ctx.closePath();
    doughnut.ctx.fill();

    // Add the image on top
    if ( doughnut.img )
      doughnut.ctx.drawImage(doughnut.img.img, doughnut.img.x, doughnut.img.y, doughnut.img.width, doughnut.img.height);
  };


  Doughnut.prototype.setVisibility = function(visibility) {
    var doughnut = this;

    if ( doughnut.visible !== visibility )
    {
      doughnut.visible = visibility;
      doughnut.options.onVisibilityChange.call(doughnut);
    }
  };

  AnimatedDoughnut.Doughnut = Doughnut;
})();


// Sets up API methods and helper classes
(function setupApiMethodsAndHelpers() {

  Object.prototype.extend = function(obj) {
    for (var i in obj) {
      if ( obj.hasOwnProperty(i) )
        this[i] = obj[i];
    }

    return this;
  };

  var apiDefaults = {
    // Default options here
    data: [],
    autostart: true,
    animationDuration: 2000,
    padding: 160,
    hollowPercentage: 65,
    font: {
      weight: '300',
      size: 12,
      family: 'Lato',
      color: '#666666'
    },
    legendBar: {
      width: 2.5,
      style: '#666666',
      spotRadius: 6,
      distancePercentage: 35
    },
    onVisibilityChange: function() {}
  };


  // Easing functions, curtosy of https://gist.github.com/gre/1650294
  var EasingFunctions = {
    // no easing, no acceleration
    linear: function (t) { return t },
    // accelerating from zero velocity
    easeInQuad: function (t) { return t*t },
    // decelerating to zero velocity
    easeOutQuad: function (t) { return t*(2-t) },
    // acceleration until halfway, then deceleration
    easeInOutQuad: function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t },
    // accelerating from zero velocity
    easeInCubic: function (t) { return t*t*t },
    // decelerating to zero velocity
    easeOutCubic: function (t) { return (--t)*t*t+1 },
    // acceleration until halfway, then deceleration
    easeInOutCubic: function (t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 },
    // accelerating from zero velocity
    easeInQuart: function (t) { return t*t*t*t },
    // decelerating to zero velocity
    easeOutQuart: function (t) { return 1-(--t)*t*t*t },
    // acceleration until halfway, then deceleration
    easeInOutQuart: function (t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t },
    // accelerating from zero velocity
    easeInQuint: function (t) { return t*t*t*t*t },
    // decelerating to zero velocity
    easeOutQuint: function (t) { return 1+(--t)*t*t*t*t },
    // acceleration until halfway, then deceleration
    easeInOutQuint: function (t) { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t }
  };


  var DataHelper = function(data) {
    var helper = this;

    helper.total = 0;
    helper.data = ( typeof data == 'string' ) ? JSON.parse(data) : data;
    helper.init();
  };

  DataHelper.prototype.init = function() {
    var helper = this;
    helper.data.forEach(function(dataPoint) {
      helper.total += dataPoint.value;
    });
  };

  var crossBrowserAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||
                                   window.webkitRequestAnimationFrame || window.msRequestAnimationFrame ||
                                   function(callback) { window.setTimeout(callback, 1000 / 60) };

  AnimatedDoughnut.requestAnimationFrame = crossBrowserAnimationFrame;
  AnimatedDoughnut.apiDefaults = apiDefaults;
  AnimatedDoughnut.EasingFunctions = EasingFunctions;
  AnimatedDoughnut.DataHelper = DataHelper;
})();