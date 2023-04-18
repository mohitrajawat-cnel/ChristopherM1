'use strict';
/**
 * Copyright Marc J. Schmidt. See the LICENSE file at the top-level
 * directory of this distribution and at
 * https://github.com/marcj/css-element-queries/blob/master/LICENSE.
 */
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(factory);
    } else if (typeof exports === "object") {
        module.exports = factory();
    } else {
        root.ResizeSensor = factory();
    }
}(typeof window !== 'undefined' ? window : this, function () {

    // Make sure it does not throw in a SSR (Server Side Rendering) situation
    if (typeof window === "undefined") {
        return null;
    }
    // Only used for the dirty checking, so the event callback count is limited to max 1 call per fps per sensor.
    // In combination with the event based resize sensor this saves cpu time, because the sensor is too fast and
    // would generate too many unnecessary events.
    var requestAnimationFrame = window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        function (fn) {
            return window.setTimeout(fn, 20);
        };

    /**
     * Iterate over each of the provided element(s).
     *
     * @param {HTMLElement|HTMLElement[]} elements
     * @param {Function}                  callback
     */
    function forEachElement(elements, callback){
        var elementsType = Object.prototype.toString.call(elements);
        var isCollectionTyped = ('[object Array]' === elementsType
            || ('[object NodeList]' === elementsType)
            || ('[object HTMLCollection]' === elementsType)
            || ('[object Object]' === elementsType)
            || ('undefined' !== typeof jQuery && elements instanceof jQuery) //jquery
            || ('undefined' !== typeof Elements && elements instanceof Elements) //mootools
        );
        var i = 0, j = elements.length;
        if (isCollectionTyped) {
            for (; i < j; i++) {
                callback(elements[i]);
            }
        } else {
            callback(elements);
        }
    }

    /**
    * Get element size
    * @param {HTMLElement} element
    * @returns {Object} {width, height}
    */
    function getElementSize(element) {
        if (!element.getBoundingClientRect) {
            return {
                width: element.offsetWidth,
                height: element.offsetHeight
            }
        }

        var rect = element.getBoundingClientRect();
        return {
            width: Math.round(rect.width),
            height: Math.round(rect.height)
        }
    }

    /**
     * Class for dimension change detection.
     *
     * @param {Element|Element[]|Elements|jQuery} element
     * @param {Function} callback
     *
     * @constructor
     */
    var ResizeSensor = function(element, callback) {
        /**
         *
         * @constructor
         */
        function EventQueue() {
            var q = [];
            this.add = function(ev) {
                q.push(ev);
            };

            var i, j;
            this.call = function() {
                for (i = 0, j = q.length; i < j; i++) {
                    q[i].call();
                }
            };

            this.remove = function(ev) {
                var newQueue = [];
                for(i = 0, j = q.length; i < j; i++) {
                    if(q[i] !== ev) newQueue.push(q[i]);
                }
                q = newQueue;
            };

            this.length = function() {
                return q.length;
            }
        }

        /**
         *
         * @param {HTMLElement} element
         * @param {Function}    resized
         */
        function attachResizeEvent(element, resized) {
            if (!element) return;
            if (element.resizedAttached) {
                element.resizedAttached.add(resized);
                return;
            }

            element.resizedAttached = new EventQueue();
            element.resizedAttached.add(resized);

            element.resizeSensor = document.createElement('div');
            element.resizeSensor.dir = 'ltr';
            element.resizeSensor.className = 'resize-sensor';
            var style = 'position: absolute; left: -10px; top: -10px; right: 0; bottom: 0; overflow: hidden; z-index: -1; visibility: hidden;';
            var styleChild = 'position: absolute; left: 0; top: 0; transition: 0s;';

            element.resizeSensor.style.cssText = style;
            element.resizeSensor.innerHTML =
                '<div class="resize-sensor-expand" style="' + style + '">' +
                    '<div style="' + styleChild + '"></div>' +
                '</div>' +
                '<div class="resize-sensor-shrink" style="' + style + '">' +
                    '<div style="' + styleChild + ' width: 200%; height: 200%"></div>' +
                '</div>';
            element.appendChild(element.resizeSensor);

            var position = window.getComputedStyle(element).getPropertyPriority('position');
            if ('absolute' !== position && 'relative' !== position && 'fixed' !== position) {
                element.style.position = 'relative';
            }

            var expand = element.resizeSensor.childNodes[0];
            var expandChild = expand.childNodes[0];
            var shrink = element.resizeSensor.childNodes[1];
            var dirty, rafId, newWidth, newHeight;
            var size = getElementSize(element);
            var lastWidth = size.width;
            var lastHeight = size.height;

            var reset = function() {
                //set display to block, necessary otherwise hidden elements won't ever work
                var invisible = element.offsetWidth === 0 && element.offsetHeight === 0;

                if (invisible) {
                    var saveDisplay = element.style.display;
                    element.style.display = 'block';
                }

                expandChild.style.width = '100000px';
                expandChild.style.height = '100000px';

                expand.scrollLeft = 100000;
                expand.scrollTop = 100000;

                shrink.scrollLeft = 100000;
                shrink.scrollTop = 100000;

                if (invisible) {
                    element.style.display = saveDisplay;
                }
            };
            element.resizeSensor.resetSensor = reset;

            var onResized = function() {
                rafId = 0;

                if (!dirty) return;

                lastWidth = newWidth;
                lastHeight = newHeight;

                if (element.resizedAttached) {
                    element.resizedAttached.call();
                }
            };

            var onScroll = function() {
                var size = getElementSize(element);
                var newWidth = size.width;
                var newHeight = size.height;
                dirty = newWidth != lastWidth || newHeight != lastHeight;

                if (dirty && !rafId) {
                    rafId = requestAnimationFrame(onResized);
                }

                reset();
            };

            var addEvent = function(el, name, cb) {
                if (el.attachEvent) {
                    el.attachEvent('on' + name, cb);
                } else {
                    el.addEventListener(name, cb);
                }
            };

            addEvent(expand, 'scroll', onScroll);
            addEvent(shrink, 'scroll', onScroll);

			// Fix for custom Elements
			requestAnimationFrame(reset);
        }

        forEachElement(element, function(elem){
            attachResizeEvent(elem, callback);
        });

        this.detach = function(ev) {
            ResizeSensor.detach(element, ev);
        };

        this.reset = function() {
            element.resizeSensor.resetSensor();
        };
    };

    ResizeSensor.reset = function(element, ev) {
        forEachElement(element, function(elem){
            elem.resizeSensor.resetSensor();
        });
    };

    ResizeSensor.detach = function(element, ev) {
        forEachElement(element, function(elem){
            if (!elem) return;
            if(elem.resizedAttached && typeof ev === "function"){
                elem.resizedAttached.remove(ev);
                if(elem.resizedAttached.length()) return;
            }
            if (elem.resizeSensor) {
                if (elem.contains(elem.resizeSensor)) {
                    elem.removeChild(elem.resizeSensor);
                }
                delete elem.resizeSensor;
                delete elem.resizedAttached;
            }
        });
    };

    return ResizeSensor;

}));

(function($) {
  'use strict';

  if (!$.isEmptyObject(window.MK)) {return}

  var MK = window.MK || {};
  window.MK = MK;
  MK.utils = window.MK.utils || {};

    /**
     * Gets user browser and its version
     * @return {Object} => {name, version}
     */
	MK.utils.browser = (function() {
        var dataBrowser = [
            {string: navigator.userAgent, subString: "Edge", identity: "Edge"},
            {string: navigator.userAgent, subString: "Chrome", identity: "Chrome"},
            {string: navigator.userAgent, subString: "MSIE", identity: "IE"},
            {string: navigator.userAgent, subString: "Trident", identity: "IE"},
            {string: navigator.userAgent, subString: "Firefox", identity: "Firefox"},
            {string: navigator.userAgent, subString: "Safari", identity: "Safari"},
            {string: navigator.userAgent, subString: "Opera", identity: "Opera"}
        ];

		var versionSearchString = null;
        var searchString = function (data) {
            for (var i = 0; i < data.length; i++) {
                var dataString = data[i].string;
                versionSearchString = data[i].subString;

                if (dataString.indexOf(data[i].subString) !== -1) {
                    return data[i].identity;
                }
            }
        };

        var searchVersion = function (dataString) {
            var index = dataString.indexOf(versionSearchString);
            if (index === -1) {
                return;
            }

            var rv = dataString.indexOf("rv:");
            if (versionSearchString === "Trident" && rv !== -1) {
                return parseFloat(dataString.substring(rv + 3));
            } else {
                return parseFloat(dataString.substring(index + versionSearchString.length + 1));
            }
        };

        var name = searchString(dataBrowser) || "Other";
        var version = searchVersion(navigator.userAgent) || searchVersion(navigator.appVersion) || "Unknown";

        // Expose for css
        $('html').addClass(name).addClass(name + version);


        return {
        	name : name,
        	version : version
        };

	})();

    /**
     * Gets user operating system
     * @return {String}
     */
	MK.utils.OS = (function() {
		if (navigator.appVersion.indexOf("Win")!=-1) return "Windows";
		if (navigator.appVersion.indexOf("Mac")!=-1) return "OSX";
		if (navigator.appVersion.indexOf("X11")!=-1) return "UNIX";
		if (navigator.appVersion.indexOf("Linux")!=-1) return "Linux";
	})();

    /**
     * Check if mobile device.
     * @return {Boolean}
     */
	MK.utils.isMobile = function() {
        // Problems with bigger tablets as users raport differences with behaviour. Switch to navigator sniffing
		// return ('ontouchstart' in document.documentElement) && matchMedia( '(max-width: 1024px)' ).matches;

        // http://www.abeautifulsite.net/detecting-mobile-devices-with-javascript/
        // if it still brings problem try to move to more sophisticated solution like
        // apachemobilefilter.org
        // detectright.com
        // web.wurfl.io
        //
        // Seems as best solution here:
        // hgoebl.github.io/mobile-detect.js

        function android() {
            return navigator.userAgent.match(/Android/i);
        }

        function blackBerry() {
            return navigator.userAgent.match(/BlackBerry/i);
        }

        function iOS() {
            return navigator.userAgent.match(/iPhone|iPad|iPod/i);
        }

        function opera() {
            return navigator.userAgent.match(/Opera Mini/i);
        }

        function windows() {
            return navigator.userAgent.match(/IEMobile/i);
        }

        return (android() || blackBerry() || iOS() || opera() || windows() || matchMedia( '(max-width: 1024px)' ).matches);

	};

    /**
     * Check if menu is switched to responsive state based on user width settings
     * @return {Boolean}
     */
    MK.utils.isResponsiveMenuState = function() {
        return window.matchMedia( '(max-width: '+ mk_responsive_nav_width +'px)').matches;
    };



    MK.utils.getUrlParameter = function getUrlParameter(sParam) {
        var sPageURL = decodeURIComponent(window.location.search.substring(1)),
            sURLVariables = sPageURL.split('&'),
            sParameterName,
            i;

        for (i = 0; i < sURLVariables.length; i++) {
            sParameterName = sURLVariables[i].split('=');

            if (sParameterName[0] === sParam) {
                return sParameterName[1] === undefined ? true : sParameterName[1];
            }
        }
    };

    MK.utils.throttle = function( delay, fn ) {
      var last;
      var deferTimer;

      return function() {
          var context = this;
          var args = arguments;
          var now = +new Date;
          if( last && now < last + delay ) {
            clearTimeout( deferTimer );
            deferTimer = setTimeout( function() {
              last = now; fn.apply( context, args );
            }, delay );
          } else {
            last = now;
            fn.apply( context, args );
          }
      };
    };

    /**
	 * This should be invoked only on page load.
	 * Scrolls to anchor from  address bar
	 */
	MK.utils.scrollToURLHash = function() {
		var loc = window.location,
			hash = loc.hash;

		if ( hash.length && hash.substring(1).length ) {
			// !loading is added early after DOM is ready to prevent native jump to anchor
			hash = hash.replace( '!loading', '' );

			// Wait for one second before animating
			// Most of UI animations should be done by then and async operations complited
			setTimeout( function() {
				MK.utils.scrollToAnchor( hash );
			}, 1000 );

			// Right after reset back address bar
			setTimeout( function() {
				window.history.replaceState(undefined, undefined, hash);
			}, 1001);
		}
  };

  	/**
	 * Controls native scroll behaviour
	 * @return {Object} => {disable, enable}
	 */
	MK.utils.scroll = (function() {
    // 37 - left arror, 38 - up arrow, 39 right arrow, 40 down arrow
  var keys = [38, 40];

    function preventDefault(e) {
      e = e || window.event;
      e.preventDefault();
      e.returnValue = false;
    }

    function wheel(e) {
      preventDefault(e);
    }

    function keydown(e) {
        for (var i = keys.length; i--;) {
            if (e.keyCode === keys[i]) {
                preventDefault(e);
                return;
            }
        }
    }

    function disableScroll() {
        if (window.addEventListener) {
            window.addEventListener('DOMMouseScroll', wheel, false);
        }
        window.onmousewheel = document.onmousewheel = wheel;
        document.onkeydown = keydown;
    }

    function enableScroll() {
        if (window.removeEventListener) {
            window.removeEventListener('DOMMouseScroll', wheel, false);
        }
        window.onmousewheel = document.onmousewheel = document.onkeydown = null;
    }

    return {
      disable : disableScroll,
      enable  : enableScroll
    };

})();

MK.utils.launchIntoFullscreen = function ( element ) {
  if(element.requestFullscreen) {
     element.requestFullscreen();
  } else if(element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if(element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen();
  } else if(element.msRequestFullscreen) {
    element.msRequestFullscreen();
  }
};

MK.utils.exitFullscreen = function () {
  if(document.exitFullscreen) {
    document.exitFullscreen();
  } else if(document.mozCancelFullScreen) {
    document.mozCancelFullScreen();
  } else if(document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  }
};

    /**
	 * Scroll Spy implementation. Spy dynamic offsets of elements or static pixel offset
	 * @param  {Number|Element}
	 * @param  {Object} => callback object {before, active, after}
	 */
	MK.utils.scrollSpy = function( toSpy, config ) {
		var $window   = $( window ),
	        container = $('.jupiterx-site')[0],
	        isObj     = ( typeof toSpy === 'object' ),
	        offset    = (isObj) ? MK.val.dynamicOffset( toSpy, config.position, config.threshold ) : function() { return toSpy; },
	        height    = (isObj) ? MK.val.dynamicHeight( toSpy ) : function() { return 0; },
	        cacheVals = {},
	        _p 		  = 'before'; // current position

		var checkPosition = function() {
	    	var s = MK.val.scroll(),
	    		o = offset(),
	    		h = height();

	        if( s < o && _p !== 'before' ) {
	        	// console.log( toSpy, 'before' );
	        	if( config.before ) config.before();
	        	_p = 'before';
	        }
	        else if( s >= o && s <= o + h && _p !== 'active' ) {
	        	// console.log( toSpy, 'active' );
	        	if( config.active ) config.active( o );
	        	_p = 'active';
	        }
	        else if( s > o + h && _p !== 'after' ) {
	        	// console.log( toSpy, 'after' );
	        	if( config.after) config.after( o + h );
	        	_p = 'after';
	        }
		};

		var rAF = function() {
			window.requestAnimationFrame( checkPosition );
		};

		var exportVals = function() {
			return cacheVals;
		};

		var updateCache = function() {
	    	var o = offset(),
	    		h = height();

	        cacheVals = {
	        	before : o - $window.height(),
	        	active : o,
	        	after : o + h
	        };
		};

		if( config.cache ) {
			config.cache( exportVals );
		}

	    checkPosition();
	    $window.on( 'load', checkPosition );
	    $window.on( 'resize', checkPosition );
	    $window.on( 'mouseup', checkPosition );
   		window.addResizeListener( container, checkPosition );

	    $window.on( 'scroll', rAF );

   		updateCache();
	    $window.on( 'load', updateCache );
	    $window.on( 'resize', updateCache );
   		window.addResizeListener( container, updateCache );
  };

  /**
   * Scrolls page to static pixel offset
   * @param  {Number}
   */
  MK.utils.scrollTo = function( offset ) {
    $('html, body').stop().animate({
      scrollTop: offset
    }, {
      duration: 1200,
    });
  };

  MK.utils.isElementInViewport = function( el ) {
    var elemTop = el.getBoundingClientRect().top;
  var isVisible = (elemTop < window.innerHeight);
  return isVisible;
};

	/**
	 * Scrolls to element passed in as object or DOM reference
	 * @param  {String|Object}
	 */
	MK.utils.scrollToAnchor = function( hash ) {
		// Escape meta-chars from hash name only.
		hash = hash.substring(1).replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, "\\$&");
		hash = "#" + hash;
		var $target = $( hash );
		// console.log( hash );

		if( ! $target.length ) return;

		var offset  = $target.offset().top;
		offset = offset - MK.val.offsetHeaderHeight( offset );

		if( hash === '#top-of-page' ) window.history.replaceState( undefined, undefined, ' ' );
		else window.history.replaceState( undefined, undefined, hash );

		MK.utils.scrollTo( offset );
	};

  /**
	 * Basic implementation of pub / sub pattern to avoid tight coupling with direct module communication
	 * @type {Object}
	 */
	MK.utils.eventManager = {};

	/**
	 * Subscribe to custom event and run callbacks
	 * @param  {String}
	 * @param  {Function}
	 *
	 * @usage MK.utils.eventManager.subscribe('event', function(e, params) {} )
	 */
	MK.utils.eventManager.subscribe = function(evt, func) {
		$(this).on(evt, func);
	};

	/**
	 * Unsubscribe from custom event
	 * @param  {String}
	 * @param  {Function}
	 */
	MK.utils.eventManager.unsubscribe = function(evt, func) {
		$(this).off(evt, func);
	};

	/**
	 * Publish custom event to notify appliaction about state change
	 * @param  {String}
	 *
	 * @usage MK.utils.eventManager.publish('event', {
	 *        	param: val
	 *        })
	 */
	MK.utils.eventManager.publish = function(evt, params) {
		$(this).trigger(evt, [params]);
  };

  /**
	 * Get all top offsets from jQuery collection
	 *
	 * @param  {$Objects}
	 * @return {Aray}
	 */
	MK.utils.offsets = function( $els ) {
		return $.map( $els, function( el ) {
			return $( el ).offset().top;
		});
  };

  /**
	 * Retrive from array of numbers first number that is higher than given parameter
	 *
	 * @param  {Number}
	 * @param  {Array}
	 * @return {Number}
	 */
	MK.utils.nextHigherVal = function( val, arr ) {
		var i = 0,
			higher = null;

		var check = function() {
			if( val > arr[ i ]) {
				i += 1;
				check();
			} else {
				higher = arr[ i ];
			}
		};
		check();

		return higher;
	};

}(jQuery));

(function($) {
	'use strict';

	var MK = window.MK || {};

	/**
	 * MK.core holds most important methods that bootstraps whole application
	 *
	 * @type {Object}
	 */
	MK.core = {};

	/**
	 * State for referance of already loaded script files
	 * @type {Array}
	 */
	var _loadedDependencies = [];

	/**
	 * State of queue represented as pairs of script ref => callback
	 * @type {Object}
	 */
	var _inQueue = {};

	/**
	 * Initializes all components in given scope (object or DOM reference) based on data attribute and 'pointer' css class '.js-el'.
	 * DOM work is reduced by single traversing for pointer class and later filtering through cached object. It expects init() method
	 * on every component. Component itself should be defined in MK.component namespace and assign to DOM element via data-mk-component.
	 * Use it once on DOM ready with document as a scope. For partial initialization after ajax operations pass as a scope element
	 * where new DOM was inserted.
	 *
	 * @param  {string|object}
	 */
	MK.core.initAll = function( scope ) {
		var $el = $( scope ).find( '.js-el' ), // single traversing
			$components = $el.filter( '[data-mk-component]' ),
			component = null;


		// initialize  component
		var init = function init(name, el) {
			var $el = $(el);

			if ( $el.data('init-' + name) ) return; // do not initialize the same module twice

			if ( typeof MK.component[ name ] !== 'function' ) console.log('Component init error: ', name);
			else {
				component = new MK.component[ name ]( el );
				component.init();
				$el.data('init-' + name, true); // mark as initialised
				// TODO add name
				MK.utils.eventManager.publish('component-inited');
			}
		};

		$components.each( function() {
			var self = this,
				$this = $( this ),
				names = $this.data( 'mk-component' );

			if( typeof names === 'string' ) {
				var name = names; // containes only single name. Keep it transparent.
				init(name, self);
			} else {
				names.forEach( function( name ) {
					init(name, self);
				});
			}
		});
	};

	/**
	 * Async loader for 3rd party plugins available from within theme or external CDNs / APIs.
	 * Take one argument as callback which is run when loading is finished. Also keeps track of already loaded scripts
	 * and prevent duplication. Holds in queue multiple callbacks that where defined in different places but depend on the
	 * same plugin.
	 *
	 * TODO: heavy test for multiple dependencies and crosssharing one dependency and different one dependency in queue,
	 * bulletproof with single dependency
	 *
	 * @example MK.core.loadDependencies([MK.core.path.plugins + 'plugin.js'], function() {
	 *          	// do something when plugin is loaded
	 * 			})
	 *
	 * @param  {array}
	 * @param  {function}
	 */
	MK.core.loadDependencies = function( dependencies, callback ) {
		var _callback = callback || function() {};

        if( !dependencies ) {
        	// If no dependencies defined then run _callback imidietelly
        	_callback();
        	return;
        }

		// Check for new dependencies
        var newDeps = dependencies.map( function( dep ) {
            if( _loadedDependencies.indexOf( dep ) === -1 ) {
            	 if( typeof _inQueue[ dep ] === 'undefined' ) {
        			// console.log( dep );
                	return dep;
                } else {
                	_inQueue[ dep ].push( _callback );
                	return true;
                }
            } else {
            	return false;
            }
        });

        // The dependency is not new but it's not resolved yet
        // Callback is added to queue that will be run after the script is loaded
        // Don't run callback just yet.
        if( newDeps[0] === true ) {
        	// console.log('Waiting for ' + dependencies[0]);
        	return;
        }

        // Dependency was loaded previously. We can run callback safely
        if( newDeps[0] === false ) {
        	_callback();
        	return;
        }

        // Create queue and relationship script -> callback array to track
        // all callbacks that waits for ths script
        var queue = newDeps.map( function( script ) {
        	// console.log( script );
        	_inQueue[ script ] = [ _callback ];
            return $.getCachedScript( script );
        });

        // Callbacks invoking
        var onLoad = function onLoad() {
        	var index;
        	newDeps.map( function( loaded ) {
        		_inQueue[ loaded ].forEach( function( callback ) {
        			callback();
        		});
        		delete _inQueue[ loaded ];
                _loadedDependencies.push( loaded );
        	});
        };

        // Run callbacks when promise is resolved
        $.when.apply( null, queue ).done( onLoad );
	};

	/**
	 * Single namespace for all paths recuired in application.
	 * @type {Object}
	 */
	MK.core.path = {
		theme: jupiterDonutVars.themeUrl,
		plugins: jupiterDonutVars.assetsUrl + '/lib/js/',
		ajaxUrl: jupiterDonutVars.ajaxUrl
	};


})(jQuery);


(function($) {
  'use strict';

  /**
   * Entry point of application. Runs all components
   */
  $( window ).on( 'load', function() {
      MK.core.initAll( document );
      MK.utils.scrollToURLHash();
  });

  /**
   * VC frontend editor. Init all components.
   */
  $( window ).on( 'vc_reload', function() {
      setTimeout(function(){
          MK.core.initAll( document );
      }, 100);
  });

  /**
   * Assign global click handlers
   */
  $( document ).on( 'click', '.js-smooth-scroll, .js-main-nav a', smoothScrollToAnchor);
  $( '.side_dashboard_menu a' ).on( 'click', smoothScrollToAnchor);

  function smoothScrollToAnchor( evt ) {
      var anchor = MK.utils.detectAnchor( this );
      var $this = $(evt.currentTarget);
      var loc = window.location;
      var currentPage = loc.origin + loc.pathname;
      var href = $this.attr( 'href' );
      var linkSplit = (href) ? href.split( '#' ) : '';
      var hrefPage  = linkSplit[0] ? linkSplit[0] : '';
      var hrefHash  = linkSplit[1] ? linkSplit[1] : '';

      if( anchor.length ) {
          if(hrefPage === currentPage || hrefPage === '') evt.preventDefault();
          MK.utils.scrollToAnchor( anchor );

      } else if( $this.attr( 'href' ) === '#' ) {
          evt.preventDefault();
      }
  }

}(jQuery));

'use strict';

/**
 * Copyright Marc J. Schmidt. See the LICENSE file at the top-level
 * directory of this distribution and at
 * https://github.com/marcj/css-element-queries/blob/master/LICENSE.
 */
(function (root, factory) {
    if (typeof define === "function" && define.amd) {
        define(['./ResizeSensor.js'], factory);
    } else if (typeof exports === "object") {
        module.exports = factory(require('./ResizeSensor.js'));
    } else {
        root.ElementQueries = factory(root.ResizeSensor);
        root.ElementQueries.listen();
    }
}(typeof window !== 'undefined' ? window : this, function (ResizeSensor) {

    /**
     *
     * @type {Function}
     * @constructor
     */
    var ElementQueries = function () {
        //<style> element with our dynamically created styles
        var cssStyleElement;

        //all rules found for element queries
        var allQueries = {};

        //association map to identify which selector belongs to a element from the animationstart event.
        var idToSelectorMapping = [];

        /**
         *
         * @param element
         * @returns {Number}
         */
        function getEmSize(element) {
            if (!element) {
                element = document.documentElement;
            }
            var fontSize = window.getComputedStyle(element, null).fontSize;
            return parseFloat(fontSize) || 16;
        }

        /**
         * Get element size
         * @param {HTMLElement} element
         * @returns {Object} {width, height}
         */
        function getElementSize(element) {
            if (!element.getBoundingClientRect) {
                return {
                    width: element.offsetWidth,
                    height: element.offsetHeight
                }
            }

            var rect = element.getBoundingClientRect();
            return {
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            }
        }

        /**
         *
         * @copyright https://github.com/Mr0grog/element-query/blob/master/LICENSE
         *
         * @param {HTMLElement} element
         * @param {*} value
         * @returns {*}
         */
        function convertToPx(element, value) {
            var numbers = value.split(/\d/);
            var units = numbers[numbers.length - 1];
            value = parseFloat(value);
            switch (units) {
                case "px":
                    return value;
                case "em":
                    return value * getEmSize(element);
                case "rem":
                    return value * getEmSize();
                // Viewport units!
                // According to http://quirksmode.org/mobile/tableViewport.html
                // documentElement.clientWidth/Height gets us the most reliable info
                case "vw":
                    return value * document.documentElement.clientWidth / 100;
                case "vh":
                    return value * document.documentElement.clientHeight / 100;
                case "vmin":
                case "vmax":
                    var vw = document.documentElement.clientWidth / 100;
                    var vh = document.documentElement.clientHeight / 100;
                    var chooser = Math[units === "vmin" ? "min" : "max"];
                    return value * chooser(vw, vh);
                default:
                    return value;
                // for now, not supporting physical units (since they are just a set number of px)
                // or ex/ch (getting accurate measurements is hard)
            }
        }

        /**
         *
         * @param {HTMLElement} element
         * @param {String} id
         * @constructor
         */
        function SetupInformation(element, id) {
            this.element = element;
            var key, option, elementSize, value, actualValue, attrValues, attrValue, attrName;

            var attributes = ['min-width', 'min-height', 'max-width', 'max-height'];

            /**
             * Extracts the computed width/height and sets to min/max- attribute.
             */
            this.call = function () {
                // extract current dimensions
                elementSize = getElementSize(this.element);

                attrValues = {};

                for (key in allQueries[id]) {
                    if (!allQueries[id].hasOwnProperty(key)) {
                        continue;
                    }
                    option = allQueries[id][key];

                    value = convertToPx(this.element, option.value);

                    actualValue = option.property === 'width' ? elementSize.width : elementSize.height;
                    attrName = option.mode + '-' + option.property;
                    attrValue = '';

                    if (option.mode === 'min' && actualValue >= value) {
                        attrValue += option.value;
                    }

                    if (option.mode === 'max' && actualValue <= value) {
                        attrValue += option.value;
                    }

                    if (!attrValues[attrName]) attrValues[attrName] = '';
                    if (attrValue && -1 === (' ' + attrValues[attrName] + ' ').indexOf(' ' + attrValue + ' ')) {
                        attrValues[attrName] += ' ' + attrValue;
                    }
                }

                for (var k in attributes) {
                    if (!attributes.hasOwnProperty(k)) continue;

                    if (attrValues[attributes[k]]) {
                        this.element.setAttribute(attributes[k], attrValues[attributes[k]].substr(1));
                    } else {
                        this.element.removeAttribute(attributes[k]);
                    }
                }
            };
        }

        /**
         * @param {HTMLElement} element
         * @param {Object}      id
         */
        function setupElement(element, id) {
            if (!element.elementQueriesSetupInformation) {
                element.elementQueriesSetupInformation = new SetupInformation(element, id);
            }
            if (!element.elementQueriesSensor) {
                element.elementQueriesSensor = new ResizeSensor(element, function () {
                    element.elementQueriesSetupInformation.call();
                });
            }

            element.elementQueriesSetupInformation.call();
        }

        /**
         * Stores rules to the selector that should be applied once resized.
         *
         * @param {String} selector
         * @param {String} mode min|max
         * @param {String} property width|height
         * @param {String} value
         */
        function queueQuery(selector, mode, property, value) {
            if (typeof(allQueries[selector]) === 'undefined') {
                allQueries[selector] = [];
                // add animation to trigger animationstart event, so we know exactly when a element appears in the DOM

                var id = idToSelectorMapping.length;
                cssStyleElement.innerHTML += '\n' + selector + ' {animation: 0.1s element-queries;}';
                cssStyleElement.innerHTML += '\n' + selector + ' > .resize-sensor {min-width: '+id+'px;}';
                idToSelectorMapping.push(selector);
            }

            allQueries[selector].push({
                mode: mode,
                property: property,
                value: value
            });
        }

        function getQuery(container) {
            var query;
            if (document.querySelectorAll) query = (container) ? container.querySelectorAll.bind(container) : document.querySelectorAll.bind(document);
            if (!query && 'undefined' !== typeof $$) query = $$;
            if (!query && 'undefined' !== typeof jQuery) query = jQuery;

            if (!query) {
                throw 'No document.querySelectorAll, jQuery or Mootools\'s $$ found.';
            }

            return query;
        }

        /**
         * If animationStart didn't catch a new element in the DOM, we can manually search for it
         */
        function findElementQueriesElements(container) {
            var query = getQuery(container);

            for (var selector in allQueries) if (allQueries.hasOwnProperty(mode)) {
                // find all elements based on the extract query selector from the element query rule
                var elements = query(selector, container);

                for (var i = 0, j = elements.length; i < j; i++) {
                    setupElement(elements[i], selector);
                }
            }
        }

        /**
         *
         * @param {HTMLElement} element
         */
        function attachResponsiveImage(element) {
            var children = [];
            var rules = [];
            var sources = [];
            var defaultImageId = 0;
            var lastActiveImage = -1;
            var loadedImages = [];

            for (var i in element.children) {
                if (!element.children.hasOwnProperty(i)) continue;

                if (element.children[i].tagName && element.children[i].tagName.toLowerCase() === 'img') {
                    children.push(element.children[i]);

                    var minWidth = element.children[i].getAttribute('min-width') || element.children[i].getAttribute('data-min-width');
                    //var minHeight = element.children[i].getAttribute('min-height') || element.children[i].getAttribute('data-min-height');
                    var src = element.children[i].getAttribute('data-src') || element.children[i].getAttribute('url');

                    sources.push(src);

                    var rule = {
                        minWidth: minWidth
                    };

                    rules.push(rule);

                    if (!minWidth) {
                        defaultImageId = children.length - 1;
                        element.children[i].style.display = 'block';
                    } else {
                        element.children[i].style.display = 'none';
                    }
                }
            }

            lastActiveImage = defaultImageId;

            function check() {
                var imageToDisplay = false, i;

                for (i in children) {
                    if (!children.hasOwnProperty(i)) continue;

                    if (rules[i].minWidth) {
                        if (element.offsetWidth > rules[i].minWidth) {
                            imageToDisplay = i;
                        }
                    }
                }

                if (!imageToDisplay) {
                    //no rule matched, show default
                    imageToDisplay = defaultImageId;
                }

                if (lastActiveImage !== imageToDisplay) {
                    //image change

                    if (!loadedImages[imageToDisplay]) {
                        //image has not been loaded yet, we need to load the image first in memory to prevent flash of
                        //no content

                        var image = new Image();
                        image.onload = function () {
                            children[imageToDisplay].src = sources[imageToDisplay];

                            children[lastActiveImage].style.display = 'none';
                            children[imageToDisplay].style.display = 'block';

                            loadedImages[imageToDisplay] = true;

                            lastActiveImage = imageToDisplay;
                        };

                        image.src = sources[imageToDisplay];
                    } else {
                        children[lastActiveImage].style.display = 'none';
                        children[imageToDisplay].style.display = 'block';
                        lastActiveImage = imageToDisplay;
                    }
                } else {
                    //make sure for initial check call the .src is set correctly
                    children[imageToDisplay].src = sources[imageToDisplay];
                }
            }

            element.resizeSensor = new ResizeSensor(element, check);
            check();
        }

        function findResponsiveImages() {
            var query = getQuery();

            var elements = query('[data-responsive-image],[responsive-image]');
            for (var i = 0, j = elements.length; i < j; i++) {
                attachResponsiveImage(elements[i]);
            }
        }

        var regex = /,?[\s\t]*([^,\n]*?)((?:\[[\s\t]*?(?:min|max)-(?:width|height)[\s\t]*?[~$\^]?=[\s\t]*?"[^"]*?"[\s\t]*?])+)([^,\n\s\{]*)/mgi;
        var attrRegex = /\[[\s\t]*?(min|max)-(width|height)[\s\t]*?[~$\^]?=[\s\t]*?"([^"]*?)"[\s\t]*?]/mgi;

        /**
         * @param {String} css
         */
        function extractQuery(css) {
            var match, smatch, attrs, attrMatch;

            css = css.replace(/'/g, '"');
            while (null !== (match = regex.exec(css))) {
                smatch = match[1] + match[3];
                attrs = match[2];

                while (null !== (attrMatch = attrRegex.exec(attrs))) {
                    queueQuery(smatch, attrMatch[1], attrMatch[2], attrMatch[3]);
                }
            }
        }

        /**
         * @param {CssRule[]|String} rules
         */
        function readRules(rules) {
            var selector = '';

            if (!rules) {
                return;
            }

            if ('string' === typeof rules) {
                rules = rules.toLowerCase();
                if (-1 !== rules.indexOf('min-width') || -1 !== rules.indexOf('max-width')) {
                    extractQuery(rules);
                }
            } else {
                for (var i = 0, j = rules.length; i < j; i++) {
                    if (1 === rules[i].type) {
                        selector = rules[i].selectorText || rules[i].cssText;
                        if (-1 !== selector.indexOf('min-height') || -1 !== selector.indexOf('max-height')) {
                            extractQuery(selector);
                        } else if (-1 !== selector.indexOf('min-width') || -1 !== selector.indexOf('max-width')) {
                            extractQuery(selector);
                        }
                    } else if (4 === rules[i].type) {
                        readRules(rules[i].cssRules || rules[i].rules);
                    } else if (3 === rules[i].type) {
                        readRules(rules[i].styleSheet.cssRules);
                    }
                }
            }
        }

        var defaultCssInjected = false;

        /**
         * Searches all css rules and setups the event listener to all elements with element query rules..
         */
        this.init = function () {
            var animationStart = 'animationstart';
            if (typeof document.documentElement.style['webkitAnimationName'] !== 'undefined') {
                animationStart = 'webkitAnimationStart';
            } else if (typeof document.documentElement.style['MozAnimationName'] !== 'undefined') {
                animationStart = 'mozanimationstart';
            } else if (typeof document.documentElement.style['OAnimationName'] !== 'undefined') {
                animationStart = 'oanimationstart';
            }

            document.body.addEventListener(animationStart, function (e) {
                var element = e.target;
                var styles = window.getComputedStyle(element, null);

                if (-1 !== styles.getPropertyValue('animation-name').indexOf('element-queries')) {
                    element.elementQueriesSensor = new ResizeSensor(element, function () {
                        if (element.elementQueriesSetupInformation) {
                            element.elementQueriesSetupInformation.call();
                        }
                    });

                    var sensorStyles = window.getComputedStyle(element.resizeSensor, null);
                    var id = sensorStyles.getPropertyValue('min-width');
                    id = parseInt(id.replace('px', ''));
                    setupElement(e.target, idToSelectorMapping[id]);
                }
            });

            if (!defaultCssInjected) {
                cssStyleElement = document.createElement('style');
                cssStyleElement.type = 'text/css';
                cssStyleElement.innerHTML = '[responsive-image] > img, [data-responsive-image] {overflow: hidden; padding: 0; } [responsive-image] > img, [data-responsive-image] > img {width: 100%;}';

                //safari wants at least one rule in keyframes to start working
                cssStyleElement.innerHTML += '\n@keyframes element-queries { 0% { visibility: inherit; } }';
                document.getElementsByTagName('head')[0].appendChild(cssStyleElement);
                defaultCssInjected = true;
            }

            for (var i = 0, j = document.styleSheets.length; i < j; i++) {
                try {
                    if (document.styleSheets[i].href && 0 === document.styleSheets[i].href.indexOf('file://')) {
                        console.log("CssElementQueries: unable to parse local css files, " + document.styleSheets[i].href);
                    }

                    readRules(document.styleSheets[i].cssRules || document.styleSheets[i].rules || document.styleSheets[i].cssText);
                } catch (e) {
                }
            }

            // findElementQueriesElements();
            findResponsiveImages();
        };

        /**
         * Go through all collected rules (readRules()) and attach the resize-listener.
         * Not necessary to call it manually, since we detect automatically when new elements
         * are available in the DOM. However, sometimes handy for dirty DOM modifications.
         *
         * @param {HTMLElement} container only elements of the container are considered (document.body if not set)
         */
        this.findElementQueriesElements = function (container) {
            findElementQueriesElements(container);
        };

        this.update = function () {
            this.init();
        };
    };

    ElementQueries.update = function () {
        ElementQueries.instance.update();
    };

    /**
     * Removes all sensor and elementquery information from the element.
     *
     * @param {HTMLElement} element
     */
    ElementQueries.detach = function (element) {
        if (element.elementQueriesSetupInformation) {
            //element queries
            element.elementQueriesSensor.detach();
            delete element.elementQueriesSetupInformation;
            delete element.elementQueriesSensor;

        } else if (element.resizeSensor) {
            //responsive image

            element.resizeSensor.detach();
            delete element.resizeSensor;
        }
    };

    ElementQueries.init = function () {
        if (!ElementQueries.instance) {
            ElementQueries.instance = new ElementQueries();
        }

        ElementQueries.instance.init();
    };

    var domLoaded = function (callback) {
        /* Mozilla, Chrome, Opera */
        if (document.addEventListener) {
            document.addEventListener('DOMContentLoaded', callback, false);
        }
        /* Safari, iCab, Konqueror */
        else if (/KHTML|WebKit|iCab/i.test(navigator.userAgent)) {
            var DOMLoadTimer = setInterval(function () {
                if (/loaded|complete/i.test(document.readyState)) {
                    callback();
                    clearInterval(DOMLoadTimer);
                }
            }, 10);
        }
        /* Other web browsers */
        else window.onload = callback;
    };

    ElementQueries.findElementQueriesElements = function (container) {
        ElementQueries.instance.findElementQueriesElements(container);
    };

    ElementQueries.listen = function () {
        domLoaded(ElementQueries.init);
    };

    return ElementQueries;

}));

//////////////////////////////////////////////////////////////////////////
//
//   Init all scripts
//
//////////////////////////////////////////////////////////////////////////

// This is bad but we don't have other access to this scope.
// Ajax Portfolio  is defined as plugin and on success needs these to be reinited
// We'll refactor all of this.
window.ajaxInit = function() {
    mk_lightbox_init();
    // mk_click_events();
    // mk_social_share_global();
   // mk_social_share();
    mk_gallery();
    loop_audio_init();
};

window.ajaxDelayedInit = function() {
    mk_flexslider_init();
    // mk_portfolio_ajax();
};

$(document).ready(function() {
    mk_lightbox_init();
    // mk_login_form();
    mk_backgrounds_parallax();
    mk_flexslider_init();
    mk_event_countdown();
    mk_skill_meter();
    mk_milestone();
    // mk_ajax_search();
    // mk_hover_events();
    // mk_portfolio_ajax();
    // product_loop_add_cart();
  //  mk_social_share();
    // mk_portfolio_widget();
    mk_contact_form();
    mk_blog_carousel();
    // mk_header_searchform();
    // mk_click_events();
    // mk_text_typer();
    mk_tab_slider_func();

    $(window).on('load', function() {
        // mk_unfold_footer();
        // mk_tabs();
        // mk_accordion_toggles_tooltip();
        mk_gallery();
        mk_theatre_responsive_calculator();
        // mk_tabs_responsive();
        // mk_start_tour_resize();
        // mk_header_social_resize();
        mk_page_section_social_video_bg();
        loop_audio_init();
        mk_one_page_scroller();
        // mkPositionSidebar();

        setTimeout(function() {
            /*
                Somehow the values are not correctly updated for the screens
                and we need to put setTimeout to fix the issue
            */
            mk_mobile_tablet_responsive_calculator();
        }, 300);

        console.log("ready for rock");
    });


    var onDebouncedResize = function() {
        mk_theatre_responsive_calculator();
        mk_mobile_tablet_responsive_calculator();
        // mk_tabs_responsive();
        // mk_accordion_toggles_tooltip();
        // mk_start_tour_resize();
        // mk_header_social_resize();

        setTimeout(function() {
            // mk_unfold_footer();
        }, 300);
    };

    var debounceResize = null;
    $(window).on("resize", function() {
        if( debounceResize !== null ) { clearTimeout( debounceResize ); }
        debounceResize = setTimeout( onDebouncedResize, 300 );
    });

    var onDebouncedScroll = function() {
        mk_skill_meter();
        //TODO: Ask to Bart how we can call javascript component
        //mk_charts();
        mk_milestone();
    };

    var debounceScroll = null;
    $(window).on("scroll", function() {
        if( debounceScroll !== null ) { clearTimeout( debounceScroll ); }
        debounceScroll = setTimeout( onDebouncedScroll, 100 );
    });

    if (MK.utils.isMobile()) {
        $('body').addClass('no-transform');
    }

});

/* VC frontend editor  */
/* -------------------------------------------------------------------- */
$(window).on("vc_reload",function () {
    mk_flexslider_init();
    loop_audio_init();
    mk_tab_slider_func();
    mk_event_countdown();
    // videoLoadState();
    mk_page_section_social_video_bg();
    // mk_hover_events();

    setTimeout(function() {
        // mkPositionSidebar();
    }, 200);
});

// Replace this if new event for remove found.
$( document ).on( 'click', '.vc_control-btn-delete', function() {
    $( window ).trigger( 'vc_reload' );
} );

$( document ).on( 'sortupdate', '.ui-sortable', function() {
    $( window ).trigger( 'vc_reload' );
} );

/* Typer */
/* -------------------------------------------------------------------- */
function mk_text_typer() {

    "use strict";

    $('[data-typer-targets]').each(function() {
        var that = this;
        MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.typed.js' ], function() {
            var $this = $(that),
                $first_string = [$this.text()],
                $rest_strings = $this.attr('data-typer-targets').split(','),
                $strings = $first_string.concat($rest_strings);

            $this.text('');

            $this.typed({
                strings: $strings,
                typeSpeed: 30, // typing speed
                backDelay: 1200, // pause before backspacing
                loop: true, // loop on or off (true or false)
                loopCount: false, // number of loops, false = infinite
            });
        });
    });
}



/* Tab Slider */
/* -------------------------------------------------------------------- */

function mk_tab_slider_func() {

    "use strict";

    $('.mk-tab-slider').each(function() {
        var that = this;

        MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.swiper.js' ], function() {
            var $this = $(that),
                id = $this.data('id'),
                $autoplayTime = $this.data('autoplay'),
                $content = $('.mk-slider-content');

            var mk_tab_slider = $this.swiper({
                wrapperClass: 'mk-tab-slider-wrapper',
                slideClass: 'mk-tab-slider-item',
                calculateHeight: true,
                speed: 500,
                autoplay: $autoplayTime,
                onSlideChangeStart: function() {
                    $('.mk-tab-slider-nav[data-id="' + id + '"]').find(".active").removeClass('active')
                    $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").eq(mk_tab_slider.activeIndex).addClass('active')
                }
            });

            // Simple repaint for firefox issue (can't handle 100% height after plugin init)
            function repaintFirefox() {
                $content.css('display','block');
                setTimeout(function() {
                    mk_tab_slider.reInit();
                    $content.css('display','table');
                },100);
            }

            $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").first().addClass('active');

            $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").on('touchstart mousedown', function(e) {
                e.preventDefault()
                $('.mk-tab-slider-nav[data-id="' + id + '"]').find(".active").removeClass('active')
                $(this).addClass('active')
                mk_tab_slider.swipeTo($(this).index())
            });

            $('.mk-tab-slider-nav[data-id="' + id + '"]').find("a").click(function(e) {
                e.preventDefault();
            });

            repaintFirefox();
            $(window).on('resize', repaintFirefox);
        });

    });

}



/* Edge One Pager */
/* -------------------------------------------------------------------- */
function mk_one_page_scroller() {

    "use strict";

    $('.mk-edge-one-pager').each(function() {
        var self = this;

        MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.fullpage.js' ], function() {

            var $this = $(self),
                anchorArr = [];

            $this.find('.section').each(function() {
                anchorArr.push($(this).attr('data-title'));
            });

            var scrollable = true;
            $this.find('.section').each(function() {
                var $section = $(this),
                    $content = $section.find('.edge-slide-content'),
                    sectionHeight = $section.height(),
                    contentHeight = $content.innerHeight();

                if((contentHeight + 30) > $(window).height()) {
                    scrollable = false;
                }
            });

            if(!scrollable){
                $this.find('.section').each(function() {
                    var $section = $(this);
                    $section.addClass('active').css({
                        'padding-bottom': '50px'
                    });
                });
            }

            if(scrollable) {
                $this.fullpage({
                    verticalCentered: false,
                    resize: true,
                    slidesColor: ['#ccc', '#fff'],
                    anchors: anchorArr,
                    scrollingSpeed: 600,
                    easing: 'easeInQuart',
                    menu: false,
                    navigation: true,
                    navigationPosition: 'right',
                    navigationTooltips: false,
                    slidesNavigation: true,
                    slidesNavPosition: 'bottom',
                    loopBottom: false,
                    loopTop: false,
                    loopHorizontal: true,
                    autoScrolling: true,
                    scrollOverflow: false,
                    css3: true,
                    paddingTop: 0,
                    paddingBottom: 0,
                    normalScrollElements: '.mk-header, .mk-responsive-wrap',
                    normalScrollElementTouchThreshold: 5,
                    keyboardScrolling: true,
                    touchSensitivity: 15,
                    continuousVertical: false,
                    animateAnchor: true,

                    onLeave: function(index, nextIndex, direction) {
                        var currentSkin = $this.find('.one-pager-slide').eq(nextIndex - 1).attr('data-header-skin');
                        MK.utils.eventManager.publish( 'firstElSkinChange', currentSkin );
                        $('#fullPage-nav').removeClass('light-skin dark-skin').addClass(currentSkin + '-skin');

                    },
                    afterRender: function() {

                        var $nav = $('#fullPage-nav');

                        setTimeout(function() {
                            var currentSkin = $this.find('.one-pager-slide').eq(0).attr('data-header-skin');
                            MK.utils.eventManager.publish( 'firstElSkinChange', currentSkin );
                            if($nav.length) $nav.removeClass('light-skin dark-skin').addClass(currentSkin + '-skin');
                        }, 300);

                        var $slide = $this.find('.section'),
                            headerHeight = MK.val.offsetHeaderHeight(0),
                            windowHeight = $(window).height();

                        $slide.height(windowHeight - headerHeight);

                        if($nav.length) {
                            $nav.css({
                                'top': 'calc(50% + ' + (headerHeight/2) + 'px)',
                                'marginTop': 0
                            });

                            var style = $this.attr('data-pagination');
                            $nav.addClass('pagination-' + style);
                        }

                        setTimeout(mk_one_pager_resposnive, 1000);
                    },
                    afterResize: function() {
                        var $slide = $this.find('.section'),
                            headerHeight = MK.val.offsetHeaderHeight(0),
                            windowHeight = $(window).height();

                        $slide.height(windowHeight - headerHeight);

                        $('#fullPage-nav').css({
                            'top': 'calc(50% + ' + (headerHeight/2) + 'px)',
                            'marginTop': 0
                        });

                        setTimeout(mk_one_pager_resposnive, 1000);
                        console.log('Reposition pager content.');
                    },
                });
            }

            // Linking to slides available for desktop and mobile scenarios
            function swipeTo(href, e) {
                href = '_' + href; // ensure a char before #
                if (!~href.indexOf('#')) return;
                var section = href.split('#')[1];
                if (~anchorArr.indexOf(section)) {
                    if (typeof e !== 'undefined') e.preventDefault();
                    if (scrollable) $.fn.fullpage.moveTo(section);
                    else MK.utils.scrollToAnchor('[data-title="'+section+'"]');
                }
            }

            // onload
            var loc = window.location;
            if(loc.hash) swipeTo(loc.hash);

            $(document).on('click', 'a', function(e) {
                var $link = $(e.currentTarget);
                swipeTo($link.attr('href'), e);
            });
        });
    });



}


function mk_one_pager_resposnive() {
    "use strict";

    $('.mk-edge-one-pager').each(function() {
        var $pager = $(this),
            headerHeight = MK.val.offsetHeaderHeight(0),
            windowHeight = $(window).height() - headerHeight;

        $pager.find('.one-pager-slide').each(function() {
            var $slide = $(this),
                $content = $slide.find('.edge-slide-content');

            if ($slide.hasClass('left_center') || $slide.hasClass('center_center') || $slide.hasClass('right_center')) {
                var contentHeight  = $content.height(),
                    distanceFromTop = (windowHeight - contentHeight) / 2;

                distanceFromTop  = (distanceFromTop < 50) ? 50 + headerHeight : distanceFromTop;

                $content.css('marginTop', distanceFromTop);
            }

            if ($slide.hasClass('left_bottom') || $slide.hasClass('center_bottom') || $slide.hasClass('right_bottom')) {
                var distanceFromTop = windowHeight - $content.height() - 90;
                $content.css('marginTop', (distanceFromTop));
            }
        });

        /**
         * Fix AM-2853
         *
         * @since 6.0.3
         *
         * At the init of Edge One Pager (EOP), EOP will render all image
         * background of each sections from top to bottom. In this case,
         * the page height will be more than screen height and the scroll
         * bar will appear. At the same time, the full width row will set
         * the container width into 100%. But, after all Slides are set up,
         * EOP height will be 100% of the screen height, so the scroll bar
         * will be disappeared. It's caused spacing issues on the left and
         * right side of the EOP container. To fix this, the row width
         * should be resized and row position should be readjusted.
         */
        var $row = $pager.parents( '.vc_row.vc_row-fluid.mk-fullwidth-true' );

        // Run only if the Edge One Pager is wrapped inside full width row.
        if ( $row.length > 0 ) {
            // Set the wrapper and row width.
            var $wrapper = $( '.mk-main-wrapper-holder' );
            var $grid = $row.children( '.mk-grid' );
            var rowWidth = $row.width();         // Original width.
            var wrapperWidth = $wrapper.width(); // The new width.

            // Run only if original width is smaller than the new width.
            if ( rowWidth >= wrapperWidth || $grid.length > 0 ) {
                return;
            }

            // Get the content left offset.
            var $content = $wrapper.find( '.theme-content' );
            var oriPos = $content.position();
            var oriPadLeft = $content.css( 'padding-left' );
            var oriLeft = parseInt( oriPos.left ) + parseInt( oriPadLeft );

            // Ensure the new width and left position is more than 0.
            if ( wrapperWidth <= 0 || oriLeft <= 0 ) {
                return;
            }

            // Resize the width and left position of row full width.
            $row.css({
                'width': wrapperWidth,
                'left': oriLeft * -1,
            });
        }
    });
}

/* Image Gallery */
/* -------------------------------------------------------------------- */

function mk_gallery() {

    "use strict";

    $('.mk-gallery .mk-gallery-item.hover-overlay_layer .item-holder').each(function() {
        var itemHolder = $(this),
            galleryDesc = itemHolder.find('.gallery-desc');

        function updatePosition() {
            var parentHeight = itemHolder.outerHeight(),
                contentHeight = galleryDesc.innerHeight();

            var paddingVal = (parentHeight - contentHeight) / 2;
            galleryDesc.css({
                'top': paddingVal,
                // 'padding-bottom': paddingVal
            });

            // console.log(parentHeight);
            // console.log(contentHeight);


        }
        updatePosition();

        $(window).on('resize', function() {
            setTimeout(function() {
                updatePosition();
            }, 1000);
        });
    });
    // Execute hover state for mk gallery item
    if ($(window).width() <= 1024) {
        $('.mk-gallery .mk-gallery-item').on('click', function (e) {
            var clicks = $(this).data('clicks');
            if (clicks) {
                // First click
                $(this).toggleClass('hover-state');
            } else {
                // Second click
                $(this).toggleClass('hover-state');
            }
            $(this).data("clicks", !clicks);
        });
    }
}

/* Theatre Slider Responsive Calculator */
/* -------------------------------------------------------------------- */

function mk_theatre_responsive_calculator() {
    var $laptopContainer = $(".laptop-theatre-slider");
    var $computerContainer = $(".desktop-theatre-slider");
    $laptopContainer.each(function() {
        var $this = $(this),
            $window = $(window),
            $windowWidth = $window.outerWidth(),
            $windowHeight = $window.outerHeight(),
            $width = $this.outerWidth(),
            $height = $this.outerHeight(),
            $paddingTop = 38,
            $paddingRight = 143,
            $paddingBottom = 78,
            $paddingLeft = 143;

        var $player = $this.find('.player-container');

        if ($windowWidth > $width) {
            $player.css({
                'padding-left': parseInt(($width * $paddingLeft) / 1200),
                'padding-right': parseInt(($width * $paddingRight) / 1200),
                'padding-top': parseInt(($height * $paddingTop) / 690),
                'padding-bottom': parseInt(($height * $paddingBottom) / 690),
            });
        }

    });

    $computerContainer.each(function() {
        var $this = $(this),
            $window = $(window),
            $windowWidth = $window.outerWidth(),
            $windowHeight = $window.outerHeight(),
            $width = $this.outerWidth(),
            $height = $this.outerHeight(),
            $paddingTop = 60,
            $paddingRight = 52,
            $paddingBottom = 290,
            $paddingLeft = 49;

        var $player = $this.find('.player-container');

        if ($windowWidth > $width) {
            $player.css({
                'padding-left': parseInt(($width * $paddingLeft) / 1200),
                'padding-right': parseInt(($width * $paddingRight) / 1200),
                'padding-top': parseInt(($height * $paddingTop) / 969),
                'padding-bottom': parseInt(($height * $paddingBottom) / 969),
            });
        }

    });

}

/* Mobile and Tablet Slideshow Responsive Calculator */
/* -------------------------------------------------------------------- */
function mk_mobile_tablet_responsive_calculator() {
    var $laptopSlideshow = $(".mk-laptop-slideshow-shortcode");
    var $lcdSlideshow = $(".mk-lcd-slideshow");

    if ($.exists(".mk-laptop-slideshow-shortcode")) {
        $laptopSlideshow.each(function() {
            var $this = $(this),
                $window = $(window),
                $windowWidth = $window.outerWidth(),
                $windowHeight = $window.outerHeight(),
                $width = $this.outerWidth(),
                $height = $this.outerHeight(),
                $paddingTop = 28,
                $paddingRight = 102,
                $paddingBottom = 52,
                $paddingLeft = 102;

            var $player = $this.find(".slideshow-container");

            $player.css({
                "padding-left": parseInt(($width * $paddingLeft) / 836),
                "padding-right": parseInt(($width * $paddingRight) / 836),
                "padding-top": parseInt(($height * $paddingTop) / 481),
                "padding-bottom": parseInt(($height * $paddingBottom) / 481),
            });

        });
    }

    if ($.exists(".mk-lcd-slideshow")) {
        $lcdSlideshow.each(function() {
            var $this = $(this),
                $window = $(window),
                $windowWidth = $window.outerWidth(),
                $windowHeight = $window.outerHeight(),
                $width = $this.outerWidth(),
                $height = $this.outerHeight(),
                $paddingTop = 35,
                $paddingRight = 39,
                $paddingBottom = 213,
                $paddingLeft = 36;

            var $player = $this.find(".slideshow-container");
            $player.css({
                "padding-left": parseInt(($width * $paddingLeft) / 886),
                "padding-right": parseInt(($width * $paddingRight) / 886),
                "padding-top": parseInt(($height * $paddingTop) / 713),
                "padding-bottom": parseInt(($height * $paddingBottom) / 713),
            });
        });
    }
}


/* Start a tour resize function */
/* -------------------------------------------------------------------- */
function mk_start_tour_resize() {

    $('.mk-header-start-tour').each(function() {

        var $windowWidth = $(document).width(),
            $this = $(this),
            $linkWidth = $this.width() + 15,
            $padding = ($windowWidth - mk_responsive_nav_width) / 2;



        function updateStartTour(){
            if($windowWidth < mk_responsive_nav_width){
                $this.removeClass('hidden');
                $this.addClass('show');
            }else{
                if($padding < $linkWidth){
                    $this.removeClass('show');
                    $this.addClass('hidden');
                }else{
                    $this.removeClass('hidden');
                    $this.addClass('show');
                }
            }
        }

        setTimeout(function() {
            updateStartTour();
        }, 300);
    });
}

/* Header social resize function */
/* -------------------------------------------------------------------- */
function mk_header_social_resize() {

    $('.mk-header-social.header-section').each(function() {

        var $windowWidth = $(document).width(),
            $this = $(this),
            $linkWidth = $this.width() + 15,
            $padding = ($windowWidth - mk_responsive_nav_width) / 2;



        function updateStartTour(){
            if($windowWidth < mk_responsive_nav_width){
                $this.removeClass('hidden');
                $this.addClass('show');
            }else{
                if($padding < $linkWidth){
                    $this.removeClass('show');
                    $this.addClass('hidden');
                }else{
                    $this.removeClass('hidden');
                    $this.addClass('show');
                }
            }
        }

        setTimeout(function() {
            updateStartTour();
        }, 300);
    });
}

/* Page Section Socail Video Player Controls */
/* -------------------------------------------------------------------- */

function mk_page_section_social_video_bg() {
    $(".mk-page-section.social-hosted").each(function() {
        var $container = $(this),
            $sound = $container.data('sound'),
            $source = $container.data('source'),
            player,
            timer = 1000;

        if ( $( 'body' ).hasClass( '.compose-mode' ) ) {
            timer = 2000;
        }

        if ($source == 'youtube') {
            var youtube = $container.find('iframe')[0];
            try {
                player = new YT.Player(youtube, {
                    events: {
                        'onReady': function () {
                           player.playVideo();
                           if($sound == false) {
                               player.mute();
                           }
                       }
                    }
                });


            } catch (e) {
            	console.log( e );
            }
        }
        if ($source == 'vimeo') {
            var vimeo = $container.find('iframe')[0];
            player = $f(vimeo);
            setTimeout(function() {
                player.api('play');
                if($sound === false) {
                    player.api('setVolume', 0);
                }
            }, timer);
        }

    });
}

// Pre RequireJS hot bug fixing

function videoLoadState() {
    $('.mk-section-video video').each(function() {
        var mkVideo = this;

        mkVideo.play();
        this.onload = fire();

        function fire() {
            setTimeout(function() {
                $(mkVideo).animate({
                    'opacity': 1
                }, 300);
            }, 1000);
        }
    });
}
videoLoadState();


// Gmap Widget
(function($) {

    $(window).on('load vc_reload', initialize);

    function initialize() {
        var $gmap = $('.gmap_widget');
        if($gmap.length && typeof google !== 'undefined') $gmap.each(run);
    }

    function run() {
        var $mapHolder = $(this);
        var myLatlng = new google.maps.LatLng($mapHolder.data('latitude'), $mapHolder.data('longitude'));
        var mapOptions = $mapHolder.data('options');
            mapOptions.mapTypeId = google.maps.MapTypeId.ROADMAP;
            mapOptions.center = myLatlng;
        var map = new google.maps.Map(this, mapOptions);

        new google.maps.Marker({
            position: myLatlng,
            map: map
        });
    }

}(jQuery));

// Instagram Widget
(function($) {

    $(window).on('load', function() {
        var $feeds = $('.mk-instagram-feeds');
        if($feeds.length) $feeds.each(run);
    });

    function run() {
        var options = $(this).data('options');
            options.template = '<a class="featured-image '+options.tmp_col+'-columns" href="{{link}}" target="_'+options.tmp_target+'"><div class="item-holder"><img src="{{image}}" /><div class="image-hover-overlay"></div></div></a>';
        var feed = new Instafeed(options);
        feed.run();
    }
}(jQuery));


// Flipbox backface visibility fix for chrome
(function($) {
     $(window).on('load', function() {
         setTimeout( function() {
            $('.chrome-flipbox-backface-fix').removeClass('chrome-flipbox-backface-fix');
         }, 300);
     });
}(jQuery));


/* Product in VC Tab Bug Fix
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {
        $('.vc_tta-tab a').on('click', function() {
            setTimeout( function() {
                $(window).trigger('resize');
            }, 100);
        });
    });
}(jQuery));


/* Vertical menu fix when childrens exceed screen height
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {
        $('#mk-vm-menu .menu-item-has-children, #mk-vm-menu .mk-vm-back').on('mouseenter', function() {
            var $header_inner = $(this).closest('.mk-header-inner'),
                $header_inner_height = $header_inner.outerHeight(),
                $header_bg = $header_inner.find('.mk-header-bg'),
                total_height = 0;
            $header_bg.css('height', '100%');
            setTimeout( function() {
                $header_inner.children(':visible').each(function() {
                    total_height += $(this).outerHeight(true);
                });
                total_height -= $header_bg.height();
                if ( total_height < $header_inner_height ) {
                    $header_bg.css('height', '100%');
                } else {
                    $header_bg.css('height', total_height + 'px');
                }
            }, 600);
        });
    });
}(jQuery));


/* Woocommerce varitions lightbox fix
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {

        var $variations_form = $('.variations_form');

        if ( $variations_form.length ) {

            var $varitions_selects = $variations_form.find('.variations').find('.value').find('select');
            $varitions_selects.on('change', function() {

                // Woocommerce variations lightbox with galleries
                var $all_img_container = $('.mk-product-image .mk-woocommerce-main-image');
                if ( $all_img_container.length ) {
                    $( $all_img_container ).each( set_lightbox_href );
                }

            });
            $varitions_selects.trigger('change');

        }

    });

    function set_lightbox_href() {

        var $product_img = $( this ).find( 'img' ),
            $lightbox    = $( this ).find( '.mk-lightbox' );

        setTimeout( function() {
            var image_url    = $product_img.attr( 'src' ),
                image_suffix = image_url.substr( image_url.lastIndexOf('.') - image_url.length ), // Get image suffix
                image_url    = image_url.slice( 0 , image_url.lastIndexOf('-') ); // Remove image size
            $lightbox.attr('href', image_url + image_suffix );
        }, 300);
    }

}(jQuery));


/* Remove video section when on mobile */
/* -------------------------------------------------------------------- */
if( typeof MK.utils.showBackgroundVideo !== 'undefined' && ! MK.utils.showBackgroundVideo ) {
    (function($) {
        if ( MK.utils.isMobile() ) {
         $('.mk-section-video video').remove();
         $('.mk-section-video').addClass('mk-section-video-disable');
        }
    }(jQuery));
}


/* Yith AJAX Product Filter & Yith Infinite Scrolling Plugin Fix
/* -------------------------------------------------------------------- */
(function($) {
    $(window).on('load', function() {

        $(document).on( 'yith-wcan-ajax-filtered yith_infs_added_elem yith-wcan-ajax-reset-filtered', function(){
            setTimeout( function() {
                MK.utils.eventManager.publish('ajaxLoaded');
                MK.core.initAll( document );
            }, 1000 );
        });

        // Fixed YITH Filter plugin causes issue for dropdown sort
        $(document).on( 'yith-wcan-ajax-filtered yith-wcan-ajax-reset-filtered', function(){
            setTimeout( function() {
                $( '.woocommerce-ordering' ).on( 'change', 'select.orderby', function() {
                    $( this ).closest( 'form' ).submit();
                });
            }, 1000 );
        });

    });
}(jQuery));


/* Toggle loading state in URL for anchor links.
 * - Add a filter to escape meta-chars from hash string.
/* -------------------------------------------------------------------- */
!function(e){var a=window.location,n=a.hash;if(n.length&&n.substring(1).length){var hSuf = n.substring(1).replace(/[!"#$%&'()*+,./:;<=>?@[\]^`{|}~]/g, "\\$&");var r=e(".vc_row, .mk-main-wrapper-holder, .mk-page-section, #comments"),t=r.filter("#"+hSuf);if(!t.length)return;n=n.replace("!loading","");var i=n+"!loading";a.hash=i}}(jQuery);


/* Determine the top spacing of sidebar for full-width page section & row.
/* -------------------------------------------------------------------- */
function mkPositionSidebar() {

	var themeContent = $( '.theme-content' ),
		lastFullWidthChild = themeContent.find( '.vc_row-full-width' ).last(),
		top,
		sidebar = $( '#theme-page > .mk-main-wrapper-holder > .theme-page-wrapper > #mk-sidebar' );

	if ( ! lastFullWidthChild.length ) {
		sidebar.removeAttr( 'style' );
		return;
	}

	top = lastFullWidthChild.offset().top - themeContent.offset().top;
	sidebar.css( 'padding-top', top );
}

(function($) {
	'use strict';

	$.exists = function(selector) {
	    return ($(selector).length > 0);
	};

	/**
	 * Helper to enable caching async scripts
	 * https://api.jquery.com/jquery.getscript/
	 * http://www.vrdmn.com/2013/07/overriding-jquerygetscript-to-include.html
	 * 
	 * @param  {String}   script url
	 * @param  {Function} callback     
	 */
	$.getCachedScript = function( url ) {
		var options = {
			dataType: "script",
			cache: true,
			url: url
		};
	 
	    // Use $.ajax() since it is more flexible than $.getScript
	    // Return the jqXHR object so we can chain callbacks
	  	return $.ajax( options );
	};



	// Fn to allow an event to fire after all images are loaded
	// usage:
	// $.ajax({
	//     cache: false,
	//     url: 'ajax/content.php',
	//     success: function(data) {
	//         $('#divajax').html(data).imagesLoaded().then(function(){
	//             // do stuff after images are loaded here
	//         });
	//     }
	// });
	$.fn.mk_imagesLoaded = function () {

	    // Edit: in strict mode, the var keyword is needed
	    var $imgs = this.find('img[src!=""]');
	    // if there's no images, just return an already resolved promise
	    if (!$imgs.length) {return $.Deferred().resolve().promise();}

	    // for each image, add a deferred object to the array which resolves when the image is loaded (or if loading fails)
	    var dfds = [];  
	    $imgs.each(function(){
	        var dfd = $.Deferred();
	        dfds.push(dfd);
	        var img = new Image();
	        img.onload = function(){dfd.resolve();};
	        img.onerror = function(){dfd.resolve();};
	        img.src = this.src;
	    });

	    // return a master promise object which will resolve when all the deferred objects have resolved
	    // IE - when all the images are loaded
	    return $.when.apply($,dfds);

	};

}(jQuery));
/**
* Detect Element Resize
*
* https://github.com/sdecima/javascript-detect-element-resize
* Sebastian Decima
*
* version: 0.5.3
**/

(function () {
	var attachEvent = document.attachEvent,
		stylesCreated = false;

	if (!attachEvent) {
		var requestFrame = (function(){
			var raf = window.requestAnimationFrame || window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame ||
								function(fn){ return window.setTimeout(fn, 20); };
			return function(fn){ return raf(fn); };
		})();

		var cancelFrame = (function(){
			var cancel = window.cancelAnimationFrame || window.mozCancelAnimationFrame || window.webkitCancelAnimationFrame ||
								   window.clearTimeout;
		  return function(id){ return cancel(id); };
		})();

		/* Detect CSS Animations support to detect element display/re-attach */
		var animation = false,
			animationstring = 'animation',
			keyframeprefix = '',
			animationstartevent = 'animationstart',
			domPrefixes = 'Webkit Moz O ms'.split(' '),
			startEvents = 'webkitAnimationStart animationstart oAnimationStart MSAnimationStart'.split(' '),
			pfx  = '';
		{
			var elm = document.createElement('fakeelement');
			if( elm.style.animationName !== undefined ) { animation = true; }

			if( animation === false ) {
				for( var i = 0; i < domPrefixes.length; i++ ) {
					if( elm.style[ domPrefixes[i] + 'AnimationName' ] !== undefined ) {
						pfx = domPrefixes[ i ];
						animationstring = pfx + 'Animation';
						keyframeprefix = '-' + pfx.toLowerCase() + '-';
						animationstartevent = startEvents[ i ];
						animation = true;
						break;
					}
				}
			}
		}

		var animationName = 'resizeanim';
		var animationKeyframes = '@' + keyframeprefix + 'keyframes ' + animationName + ' { from { opacity: 0; } to { opacity: 0; } } ';
		var animationStyle = keyframeprefix + 'animation: 1ms ' + animationName + '; ';
	}

	function createStyles() {
		if (!stylesCreated) {
			//opacity:0 works around a chrome bug https://code.google.com/p/chromium/issues/detail?id=286360
			var css = (animationKeyframes ? animationKeyframes : '') +
					'.resize-triggers { ' + (animationStyle ? animationStyle : '') + 'visibility: hidden; opacity: 0; } ' +
					'.resize-triggers, .resize-triggers > div, .contract-trigger:before { content: \" \"; display: block; position: absolute; top: 0; left: 0; height: 100%; width: 100%; overflow: hidden; } .resize-triggers > div { background: #eee; overflow: auto; } .contract-trigger:before { width: 200%; height: 200%; }',
				head = document.head || document.getElementsByTagName('head')[0],
				style = document.createElement('style');

			style.type = 'text/css';
			if (style.styleSheet) {
				style.styleSheet.cssText = css;
			} else {
				style.appendChild(document.createTextNode(css));
			}

			head.appendChild(style);
			stylesCreated = true;
		}
	}

	window.addResizeListener = function(element, fn){

    function resetTriggers(element){
			var triggers = element.__resizeTriggers__,
				expand = triggers.firstElementChild,
				contract = triggers.lastElementChild,
				expandChild = expand.firstElementChild;
			contract.scrollLeft = contract.scrollWidth;
			contract.scrollTop = contract.scrollHeight;
			expandChild.style.width = expand.offsetWidth + 1 + 'px';
			expandChild.style.height = expand.offsetHeight + 1 + 'px';
			expand.scrollLeft = expand.scrollWidth;
			expand.scrollTop = expand.scrollHeight;
		};

		function checkTriggers(element){
			return element.offsetWidth != element.__resizeLast__.width ||
						 element.offsetHeight != element.__resizeLast__.height;
		}

		function scrollListener(e){
			var element = this;
			resetTriggers(this);
			if (this.__resizeRAF__) cancelFrame(this.__resizeRAF__);
			this.__resizeRAF__ = requestFrame(function(){
				if (checkTriggers(element)) {
					element.__resizeLast__.width = element.offsetWidth;
					element.__resizeLast__.height = element.offsetHeight;
					element.__resizeListeners__.forEach(function(fn){
						fn.call(element, e);
					});
				}
			});
    };

    if (!element) {return}

		if (attachEvent) element.attachEvent('onresize', fn);
		else {
			if (!element.__resizeTriggers__) {
				if (getComputedStyle(element).position == 'static') element.style.position = 'relative';
				createStyles();
				element.__resizeLast__ = {};
				element.__resizeListeners__ = [];
				(element.__resizeTriggers__ = document.createElement('div')).className = 'resize-triggers';
				element.__resizeTriggers__.innerHTML = '<div class="expand-trigger"><div></div></div>' +
																						'<div class="contract-trigger"></div>';
				element.appendChild(element.__resizeTriggers__);
				resetTriggers(element);
				element.addEventListener('scroll', scrollListener, true);

				/* Listen for a css animation to detect element display/re-attach */
				animationstartevent && element.__resizeTriggers__.addEventListener(animationstartevent, function(e) {
					if(e.animationName == animationName)
						resetTriggers(element);
				});
			}
			element.__resizeListeners__.push(fn);
		}
	};

	window.removeResizeListener = function(element, fn){
		if (attachEvent) element.detachEvent('onresize', fn);
		else {
			element.__resizeListeners__.splice(element.__resizeListeners__.indexOf(fn), 1);
			if (!element.__resizeListeners__.length) {
					element.removeEventListener('scroll', scrollListener);
					element.__resizeTriggers__ = !element.removeChild(element.__resizeTriggers__);
			}
		}
	}
})();

(function($) {
	'use strict';

	var MK = window.MK || {};

	/**
	* 	MK.val is collection of Lambdas responsible for returning up to date values of method type like scrollY or el offset.
	* 	The Lambda is responsible for keeping track of value of a particular property, usually takes as argument an object
	* 	(or DOM reference) and internally creates and updates data that is returned as primitive value - through variable reference.
	*
	*  Benefits of this approach:
	*  - reduced DOM reads
	*  - auto-updating values without need for additional logic where methods are called
	*  - updating values when needed to be updated not read
	*
	*  Downsides:
	*  - Memory overhead with closures and keeping state in memory ( still beter than read state from DOM, but use wisely -
	*    do not use it when you really need static value on runtime )
	*/
	MK.val = {};

	/**
	* Current window offsetY position
	*
	* @uses   MK.val.scroll()
	* @return {number}
	*/
	MK.val.scroll = (function() {
		var offset = 0,
		$window = $(window),
		hasPageYOffset = (window.pageYOffset !== undefined),
		body = (document.documentElement || document.body.parentNode || document.body); // cross browser handling

		var update = function() {
			offset = hasPageYOffset ? window.pageYOffset : body.scrollTop;
		};

		var rAF = function() {
			window.requestAnimationFrame(update);
		};

		update();
		$window.on('load', update);
		$window.on('resize', update);
		$window.on('scroll', rAF);

		return function() {
			return offset;
		};
	})();


	/**
	* Changes number of percent to pixels based on viewport height
	*
	* @uses   MK.val.viewportPercentHeight({percent val})
	* @param  {number}
	* @return {number}
	*/
	MK.val.viewportPercentHeight = function(percent) {
		return $(window).height() * (percent / 100);
	};


	/**
	* Wordpress adminbar height based on wp media queries
	* @return {Number}
	*/
	MK.val.adminbarHeight = function() {
		if (php.hasAdminbar) {
			// apply WP native media-query and sizes
			return (window.matchMedia('( max-width: 782px )').matches) ? 46 : 32;
		} else {
			return 0;
		}
	};


	/**
	* Offset when header becomes sticky. Evaluates viewport % and header height to pixels for according options
	* @return {Number}
	*/
	MK.val.stickyOffset = (function() {
		var $header = $('.mk-header').not('.js-header-shortcode').first();

		// We need to have returning function even when header is disabled
		if (!$header.length) {
			return function() {
				return 0;
			};
		}



		var $toolbar = $header.find('.mk-header-toolbar'),
		config = $header.data(),
		hasToolbar = $toolbar.length,
		toolbarHeight = (hasToolbar) ? $toolbar.height() : 0,
		isVertical = (config.headerStyle === 4),
		headerHeight = (isVertical) ? 0 : config.height;

		var type = ((typeof config.stickyOffset === 'number') ? 'number' : false) ||
		((config.stickyOffset === 'header') ? 'header' : false) ||
		'percent';

		var stickyOffset = 0;
		var setOffset = function() {

			//we calculate toolbar height for When the device is changed Size
			//Toolbar height in responsive state is 0
			toolbarHeight = (hasToolbar) ? $toolbar.height() : 0;

			if (MK.utils.isResponsiveMenuState()) {
				headerHeight = config.responsiveHeight;

				if (hasToolbar) {
					if ($toolbar.is(':hidden')) {
						toolbarHeight = 0;
					}
				}
			}

			if (type === 'number') {
				stickyOffset = config.stickyOffset;
			} else if (type === 'header') {

				stickyOffset = headerHeight + toolbarHeight + MK.val.adminbarHeight(); // add all header components here, make them 0 if needed

			} else if (type === 'percent') {
				stickyOffset = MK.val.viewportPercentHeight(parseInt(config.stickyOffset));
			}
		};

		setOffset();
		$(window).on('resize', setOffset);

		return function() {
			return stickyOffset;
		};
	}());



	/**
	* Gets header height on particular offsetY position. Use to determine logic for fullHeight, smooth scroll etc.
	* Takes one parameter which is offset position we're interested in.
	*
	* @uses   MK.val.offsetHeaderHeight({offset val})
	* @param  {number}
	* @return {number}
	*/
	MK.val.offsetHeaderHeight = (function() { // Closure avoids multiple DOM reads. We need to fetch header config only once.
		var $header = $('.mk-header').not('.js-header-shortcode').first();

		// We need to have returning function even when header is disabled
		if (!$header.length) {
			return function() {
				return 0;
			};
		}

		var $toolbar = $header.find('.mk-header-toolbar'),
		config = $header.data(),
		stickyHeight = config.stickyHeight,
		desktopHeight = config.height,
		mobileHeight = config.responsiveHeight,
		isTransparent = $header.hasClass('transparent-header'),
		isSticky = config.stickyStyle.length,
		isStickyLazy = config.stickyStyle === 'lazy',
		isVertical = config.headerStyle === 4,
		hasToolbar = $toolbar.length,
		toolbarHeight = hasToolbar ? $toolbar.height() : 0,
		bufor = 5;

		/**
		 * The sticky section of header style 2 has fixed height.
		 * The stickey height option does not affect this header style.
		 */
		if ( config.headerStyle === 2 ) {
			stickyHeight = $header.find( '.mk-header-nav-container' ).outerHeight();
		}

		// if header has border bottom we can calculate that (for responsive state)
		var $innerHeader = $header.find('.mk-header-inner');
		var hasInnerHeader = $innerHeader.length;

		var headerHeight = function(offset) {

			toolbarHeight = hasToolbar ? $toolbar.height() : 0
			var stickyOffset = MK.val.stickyOffset();


			if (MK.utils.isResponsiveMenuState()) { //  Header avaible only on top for mobile

				if (hasToolbar && $toolbar.is(':hidden')) {
					toolbarHeight = 0;
				}

				//in responsive state , .mk-header-holder position's changed to "relative"
				//and header's border affected to offset,so borders must be calculated
				var headerBorder = 0;
				headerBorder = parseInt($innerHeader.css('border-bottom-width'));

				var totalHeight = mobileHeight + MK.val.adminbarHeight() + toolbarHeight + headerBorder;

				if (offset <= totalHeight) return totalHeight;
				else return MK.val.adminbarHeight();
			} else {
				if (offset <= stickyOffset) {
					if (isVertical) {
						if (hasToolbar) {
							return toolbarHeight + MK.val.adminbarHeight();
						} else {
							return MK.val.adminbarHeight();
						}
					} else if (isTransparent) {
						return MK.val.adminbarHeight();
					} else {
						return desktopHeight + toolbarHeight + MK.val.adminbarHeight();
					} // For any other return regular desktop height
				} else if (offset > stickyOffset) {
					if (isVertical) {
						return MK.val.adminbarHeight();
					} else if (!isSticky) {
						return MK.val.adminbarHeight();
					} else if (isStickyLazy) {
						return MK.val.adminbarHeight();
					} else if (isSticky) {
						return stickyHeight + MK.val.adminbarHeight();
					}
				}
			}
			// default to 0 to prevent errors ( need to return number )
			// Anyway make sure all scenarios are covered in IFs
			return 0;
		};

		return function(offset) {
			return headerHeight(offset - MK.val.adminbarHeight());
		};
	})();


	/**
	* Gets current offset of given element (passed as object or DOM reference) from top or bottom (default to top)
	* of screen  with possible threshold (default to 0)
	*
	* @uses   MK.val.dynamicOffset({obj reference}, {'top'|'bottom'}, {threshold val})
	* @param  {string|object}
	* @param  {string}
	* @param  {number}
	* @return {number}
	*/
	MK.val.dynamicOffset = function(el, position, threshold) {
		var $window = $(window),
		$el = $(el),
		pos = position || 'top',
		thr = threshold || 0,
		container = $('.jupiterx-site')[0],
		currentPos = 0;

		var offset = 0,
		winH = 0,
		rect = 0,
		x = 0;

		var update = function() {
			winH = $window.height();
			rect = $el[0].getBoundingClientRect();
			offset = (rect.top + MK.val.scroll());
			x = (pos === 'top') ? MK.val.offsetHeaderHeight(offset) : winH + (rect.height - thr);
			currentPos = offset - x - 1;
		};

		update();
		$window.on('load', update);
		$window.on('resize', update);
		window.addResizeListener(container, update);

		return function() {
			return currentPos;
		};
	};

	/**
	* Gets current height of given element (passed as object or DOM reference)
	*
	* @uses   MK.val.dynamicHeight({obj reference})
	* @param  {string|object}
	* @return {number}
	*/
	MK.val.dynamicHeight = function(el) {
		var $window = $(window),
		$el = $(el),
		container = $('.jupiterx-site')[0],
		currentHeight = 0;

		var update = function() {
			currentHeight = $el.outerHeight();
		};

		update();
		$window.on('load', update);
		$window.on('resize', update);
		window.addResizeListener(container, update);

		return function() {
			return currentHeight;
		};
	};

})(jQuery);

(function($) {
    'use strict';

    var Accordion = function(el) { 
        // Private
        var that = this,
            $el = $(el),
            initial = $el.data('initialindex'),
            timeout;

        // Public
        this.$el = $el;
        this.$single = $('.' + this.dom.single, $el);
        this.isExpendable = ($el.data('style') === 'toggle-action');

        // Init 
        this.bindClicks();
        // Reveal initial tab on load event (wait for possible images inside)
        $(window).on('load', function() {
            if( initial !== -1 ) that.show(that.$single.eq(initial), true)
        });
        $(window).on('resize', function() {
            clearTimeout(timeout);
            timeout = setTimeout(that.bindClicks.bind(that), 500);
        }); 
    }

    Accordion.prototype.dom = {
        // only class names please!
        single        : 'mk-accordion-single',
        tab           : 'mk-accordion-tab',
        pane          : 'mk-accordion-pane',
        current       : 'current',
        mobileToggle  : 'mobile-false',
        mobileBreakPoint : 767
    }

    Accordion.prototype.bindClicks = function() {
        // Prevent multiple events binding
        this.$single.off('click', '.' + this.dom.tab);

        if( !(window.matchMedia('(max-width: ' + this.dom.mobileBreakPoint +'px)').matches 
          && this.$el.hasClass(this.dom.mobileToggle)) ) {

            this.$single.on('click', '.' + this.dom.tab, this.handleEvent.bind(this));
            // When website is loaded in mobile view and resized to desktop 'current' will 
            // inherit display: none from css. Repair it by calling show() on this element
            var $current = $('.' + this.dom.current, this.$el);
            if($('.' + this.dom.pane, $current).css('display') === 'none') this.show($current);
        }
    }

    Accordion.prototype.handleEvent = function(e) {
        e.preventDefault();
        e.stopPropagation();

        var $single = $(e.delegateTarget);

        if(!$single.hasClass(this.dom.current)) {
            this.show($single);
        }
        else {
            if(this.isExpendable) this.hide($single);
        }
    }

    Accordion.prototype.hide = function($single) {
        $single.removeClass(this.dom.current);
        $('.' + this.dom.pane, $single).slideUp();
    }

    Accordion.prototype.show = function($single, initial) {
        // hide currently opened tab
        if(!this.isExpendable) {
            var that = this;
            this.hide($('.' + this.dom.current, that.$el));
        }

        $single.addClass(this.dom.current);
        $('.' + this.dom.pane, $single).slideDown( '', function() {
          if ( initial || ! $(this).parents('.mk-accordion').hasClass('scroll-click') ) {
            return;
          }

          if (typeof $single.prev() === 'undefined') {
            $single = $single.prev()
          }

          window.scrollTo({ top: $single.offset().top - 100, left: 0, behavior: 'smooth' });
        } );
    }



    // ///////////////////////////////////////
    //
    // Apply to:
    //
    // ///////////////////////////////////////

	function init() {
		$('.mk-accordion').each(function() {
			new Accordion(this);
		});
	}

	init();
	$(window).on('vc_reload', init);

})(jQuery);
(function($) {
  'use strict';

  var MK = window.MK || {};
  window.MK = MK;
  MK.ui = window.MK.ui || {};

  var _ajaxUrl = MK.core.path.ajaxUrl;
  var _instances = {};

	MK.utils.ajaxLoader = function ajaxLoader(el) {
		// retrun a cached instance to have control over state from within multiple places
		// we may need for example to reset pageId when do filtering. It is really one instance that controls both filtering and pagination / load more
		var id = '#' + ($(el).attr('id'));
		if(typeof _instances[id] !== 'undefined') return _instances[id];

		// else lets start new instance
		this.id = id;
		this.el = el;
		this.isLoading = false;
		this.xhrCounter = 0;
	};

	MK.utils.ajaxLoader.prototype = {
		init: function init() {
			// prevent double initialization of we return an instance
			if ( this.initialized && typeof window.vc_iframe === 'undefined' ) {
				return;
			}

			this.createInstance();
			this.cacheElements();

			this.initialized = true;
		},

		cacheElements: function cacheElements() {
			this.$container = $(this.el);
			this.id = '#' + (this.$container.attr('id'));
	        this.categories = this.$container.data('loop-categories');

			this.data = {};
			this.data.action = 'mk_load_more';
	        this.data.query = this.$container.data('query');
	        this.data.atts = this.$container.data('loop-atts');
	        this.data.loop_iterator = this.$container.data('loop-iterator');
	        this.data.author = this.$container.data('loop-author');
	        this.data.posts = this.$container.data('loop-posts');
	        this.data.safe_load_more = this.$container.siblings('#safe_load_more').val();
	        this.data._wp_http_referer = this.$container.siblings('input[name="_wp_http_referer"]').val();
	        this.data.paged = 1;
	        this.data.maxPages = this.$container.data('max-pages');
	        this.data.term = this.categories;
		},

		createInstance: function() {
			_instances[this.id] = this;
		},

		load: function load(unique) {
			var self = this;
			var seq = ++this.xhrCounter;
            this.isLoading = true;

			// If mk-ajax-loaded-posts span exists, get the post ids
			if ( this.$container.siblings('.mk-ajax-loaded-posts').length ) {
				var loaded_posts = this.$container.siblings('.mk-ajax-loaded-posts').attr('data-loop-loaded-posts');

				// Do not send looaded posts for Classic Pagination Navigation
				if ( this.$container.attr('data-pagination-style') != 1 ) {
					self.data.loaded_posts = loaded_posts.split(',');
				}
			}

            return $.when(
	            $.ajax({
	                url 	: _ajaxUrl,
	                type 	: "POST",
	                data 	: self.data
	            })
	        ).done(function(response) {
	        	self.onDone(response, unique, seq);
	        });
		},

		onDone: function(response, unique, seq) {
			if(seq === this.xhrCounter) {
				var self = this;

				response = $.parseJSON(response);
				response.unique = unique;
				response.id = this.id;

				// If mk-ajax-loaded-posts span exists, update current post ids
				// with new post ids from server's response
				if ( this.$container.siblings('.mk-ajax-loaded-posts').length ) {
					this.$container.siblings('.mk-ajax-loaded-posts').attr('data-loop-loaded-posts', response.loaded_posts);
				}

	            this.setData({
	                maxPages: response.maxPages,
	                found_posts: response.found_posts,
	                loop_iterator: response.i
	            });

				// Preload images first by creating object from returned content.
				// mk_imagesLoaded() method will create a promise that gets resolved when all images inside are loaded.
				// Our ajaxLoad is somehow more similar to window.onload event now.
				$(response.content).mk_imagesLoaded().then(function() {
					MK.utils.eventManager.publish('ajaxLoaded', response);
		        	self.isLoading = false;
		        	self.initNewComponents();
				});

	        } else console.log('XHR request nr '+ seq +' aborted');

        },

		setData: function setData(atts) {
			for(var att in atts) {
				if(att === 'term' && atts[att] === '*') this.data.term = '';
				else this.data[att] = atts[att];
			}
		},

		getData: function getData(att) {
			return this.data[att];
		},

		initNewComponents: function initNewComponents() {
            // Legacy scripts reinit
            window.ajaxInit();
            setTimeout(window.ajaxDelayedInit, 1000);
            // New way to init apended things
            MK.core.initAll(this.el);
        }
	};

}(jQuery));

/* Background Parallax Effects */
/* -------------------------------------------------------------------- */

function mk_backgrounds_parallax() {

  "use strict";

  $('.mk-parallax-enabled').each(function () {
    var $this = $( this );
    if (!MK.utils.isMobile()) {
      MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.parallax.js' ], function() {
        $this.parallax("49%", 0.3);
      });
    }
  });

  $('.mk-fullwidth-slideshow.parallax-slideshow').each(function () {
    var $this = $( this );
    if (!MK.utils.isMobile()) {
      MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.parallax.js' ], function() {
        var speed_factor = $this.attr('data-speedFactor');
        $this.parallax("49%", speed_factor);
      });
    }
  });

}


var MK = window.MK || {};
window.MK = MK;
MK.component = window.MK.component || {};

MK.component.BackgroundImageSetter = (function ($) {

	'use strict';

	var module = {};


	/*---------------------------------------------------------------------------------*/
	/* Private Variables
	/*---------------------------------------------------------------------------------*/

	/**
	 *	Take all elements with data-mk-img-set attribute and evaluate best image according to given device orientation and resolution,
	 *	sets style for backround-image on the same node element.	 *
	 */

	var $win = $(window),
		// $layers = $('[data-mk-img-set]'),
		screen = getScreenSize(),
		orientation = getOrientation(),
		device = getDevice(),
		lastOrientation = orientation,
		lastDevice = device;


	/*---------------------------------------------------------------------------------*/
	/* Private Methods
	/*---------------------------------------------------------------------------------*/

	function run($layers) {
		$layers.filter( function() {
			return !this.hasAttribute("mk-img-loaded");
		}).each(applyBg);
	}

	// Keep our main side effect out of calculations so they can be run once before loop of applying bg as a result
	function applyBg() {
		var $this = $(this),
			imgs = $this.data('mk-img-set');

		$this.css('background-image', 'url('+ module.getImage(imgs) +')');
		$this.find('.mk-adaptive-image').attr('src', module.getImage(imgs));
	}

	// Keep track of current screen size while resizing but update device reference
	// and reapply backgrounds only when we discover switch point
	function handleResize($layers) {
		updateScreenSize();
		if(hasSwitched()) {
			updateDevice();
			run($layers);
		}
	}

	function getScreenSize() {
		return {
			w: $win.width(),
			h: $win.height()
		};
	}

	// Name our device classes and add them id which simply means which one is wider
	function getDevice() {
		if     (screen.w > 1024) 	return {class: 'desktop', id: 2};
		else if(screen.w > 736) 	return {class: 'tablet',  id: 1};
		else 					 	return {class: 'mobile',  id: 0};
	}

	function getOrientation() {
		if(screen.w > screen.h) 	return 'landscape';
		else 						return 'portrait';
	}

	function updateScreenSize() {
		screen = getScreenSize();
	}

	function updateDevice() {
		if(lastOrientation !== orientation) orientation = lastOrientation;
		// Switch device only if going from smaller size to bigger.
		// Bigger to smaller is perfectly handled by browsers and doesn't require change and reupload
		if(lastDevice.id > device.id) device = lastDevice;
	}

	function hasSwitched() {
		lastOrientation = getOrientation();
		lastDevice = getDevice();

		if(lastOrientation !== orientation || lastDevice.class !== device.class) return true;
		else return false;
	}


	/*---------------------------------------------------------------------------------*/
	/* Public Methods
	/*---------------------------------------------------------------------------------*/

	// As desired image might be not available we have to evaluate the best match.
	module.getImage = function (imgs) {
		if (imgs['responsive'] === 'false') {
			return (imgs['landscape']['desktop']) ? imgs['landscape']['desktop'] : (imgs['landscape']['external'] ? imgs['landscape']['external'] : '');

		}
		var hasOrientation = !!imgs[orientation];
		// there are only two orientations now and we may get them by string name if both are there
		// or by index of 0 if only one is available. Note Objects has no lexical order so we need to grab key name by its index.
		// Also we may have external file for each orientation which we don't scale internaly so we grab it as it is. If nothing found return an empty string
		var imgOriented = imgs[ (hasOrientation ? orientation : Object.keys(imgs)[0]) ],
			imgExact    = (imgOriented[device.class]) ? imgOriented[device.class] : (imgOriented['external'] ? imgOriented['external'] : '');
		return imgExact;
	}

	module.init = function ($layers) {

		// Run and bind
		run($layers);
		$layers.attr('mk-img-loaded', '');
	};

	module.onResize = function ($layers) {
		$win.on('resize', MK.utils.throttle( 500, function() {
			handleResize($layers);
		}));
	};

	return module;

}(jQuery));


jQuery(function($) {

	var init = function init() {
		// Get All Layers, Excluding Edge Slider and Page Section
		var $allLayers = $('[data-mk-img-set]').filter(function(index) {
			return !$(this).hasClass('mk-section-image') && !$(this).hasClass('background-layer') && !$(this).hasClass('mk-video-section-touch');
		});;

		// Handle the resize
		MK.component.BackgroundImageSetter.onResize($allLayers);

		// Set all the BG Layers
		MK.component.BackgroundImageSetter.init($allLayers);
	}
	init();

	$(window).on('vc_reload', init);

});

/* Blog, Portfolio Audio */
/* -------------------------------------------------------------------- */

function loop_audio_init() {
  if (!$.exists('.jp-jplayer')) {
    return;
  }

  $('.jp-jplayer.mk-blog-audio').each(function () {
    var $this = $(this);
    var $thisControls = $this.next('.jp-audio');
    var audio = $this.find( '.mk-audio' )[0];

    // Set initial values.
    $thisControls.find('.jp-current-time').text('0:0');
    $thisControls.find('.jp-volume-bar-value').css('width', 25);

    /*
     * When audio data is loaded.
     */
    audio.addEventListener('loadeddata', jsPlayerloaded(audio, $thisControls), false);

    audio.addEventListener('loadedmetadata', function() {
      var minutes = Math.floor(audio.duration / 60);
      var seconds = Math.floor(audio.duration % 60);

      // Update the duration time.
      if (!isNaN(minutes)) {
        $thisControls.find('.jp-duration').text(minutes + ':' + seconds);
      }

      // Show play button when audio is loaded.
      $thisControls.removeClass('jp-audio-loading').addClass('jp-audio-loaded');
    });

    /*
     * When audio is playing.
     */
    audio.addEventListener('timeupdate', function() {
      var minutes = Math.floor(audio.currentTime / 60);
      var seconds = Math.floor(audio.currentTime % 60);

      // Update curren time.
      $thisControls.find('.jp-current-time').text(minutes + ':' + seconds);

      // Convert length of audio to 0 - 100 while keeping ratio.
      var position = ((audio.currentTime - 0) / (audio.duration - 0)) * (100 - 0) + 0;

      // Update position of progress bar.
      $thisControls.find('.jp-play-bar').css('width', position + '%');
    });

    /*
     * When audio is ended.
     */
    audio.addEventListener('ended', function() {
      // Show play button.
      $thisControls.removeClass('jp-audio-playing');

      // Reset the position of progress bar.
      $thisControls.find('.jp-play-bar').css('width', 0);

      // Reset the current time.
      $thisControls.find('.jp-current-time').text('0:0');
    });

    /*
     * Play the audio.
     */
    $thisControls.find('.jp-play').on('click', function() {
      audio.play();

      // Show pause button.
      $thisControls.addClass('jp-audio-playing').removeClass('jp-audio-paused');
    });

    /*
     * Pause the audio..
     */
    $thisControls.find('.jp-pause').on('click', function() {
      audio.pause();

      // Show play button.
      $thisControls.addClass('jp-audio-paused').removeClass('jp-audio-playing');
    });

    /*
     * Mute the audio.
     */
    $thisControls.find('.jp-volume-bar svg').on('click', function() {
      audio.muted = !audio.muted;

      $(this).parent().toggleClass('jp-muted');
    });

    /*
     * Adjust the volume.
     */
    $thisControls.find('.inner-value-adjust').on('click', function(e) {
      // Get the posiiton of mouse click, between 0 to 25.
      var position = e.pageX - $(this).offset().left;

      // Scale the number from 0 - 25 to 0 - 1 while keeping ratio.
      var volume = ((position - 0) / (25 - 0)) * (1 - 0) + 0;

      // Set volume.
      audio.volume = volume;

      // Update the position of volume bar.
      $(this).find('.jp-volume-bar-value').css('width', position);
    });

    /*
     * Adjust current time from progress bar.
     */
    $thisControls.find('.jp-seek-bar').on('click', function(e) {
      // Get the position of mouse click.
      var position = e.pageX - $(this).offset().left;

      // Scale the number from 0 - currentTime to 0 - 100 while keeping ratio.
      var currnetTime = ((position - 0) / ($(this).width() - 0)) * (audio.duration - 0) + 0;

      // Set current time.
      audio.currentTime = currnetTime;

      // Update the position of progress bar.
      $thisControls.find('.jp-play-bar').css('width', currnetTime + '%');
    });
  });

  function jsPlayerloaded(audio, $thisControls) {
    var minutes = Math.floor(audio.duration / 60);
    var seconds = Math.floor(audio.duration % 60);

    // Update the duration time.
    if (!isNaN(minutes)) {
      $thisControls.find('.jp-duration').text(minutes + ':' + seconds);
    }

    // Show play button when audio is loaded.
    $thisControls.removeClass('jp-audio-loading').addClass('jp-audio-loaded');
  }
}

/* Blog Loop Carousel Shortcode */
/* -------------------------------------------------------------------- */


function mk_blog_carousel() {

  "use strict";

  if (!$.exists('.mk-blog-showcase')) {
    return;
  }
  $('.mk-blog-showcase ul li').each(function () {

    $(this).mouseenter( function () {

      $(this).siblings('li').removeClass('mk-blog-first-el').end().addClass('mk-blog-first-el');

    });

  });


}




/**
 * Contact Form
 *
 * Mostly implemented in Vanilla JS instead of jQuery.
 */
function mk_contact_form() {
    "use strict";
    var mkContactForms = document.getElementsByClassName('mk-contact-form');
    if (mkContactForms.length === 0) {
        return;
    }
    var captchaImageHolder = $('.captcha-image-holder');
    var activeClassName = 'is-active';
    var invalidClassName = 'mk-invalid';
    for (var i = 0; i < mkContactForms.length; i++) {
        initializeForm(mkContactForms[i], activeClassName, invalidClassName);
    }
    if (captchaImageHolder.length > 0) {
        $(window).on('load', initializeCaptchas);
    }
    /**
     * Initialize mk forms. e.g add activeClassName for inputs.
     *
     * @param form
     * @param activeClassName
     * @param invalidClassName
     */
    function initializeForm(form, activeClassName, invalidClassName) {
        var inputs = getFormInputs(form);
        for (var i = 0; i < inputs.length; i++) {
            markActiveClass(inputs[i]);
        }
        form.addEventListener('submit', function(e) {
            validateForm(e, invalidClassName);
        });
        /**
         * Set activeClassName for the parent node of the inout
         */
        function setActiveClass() {
            addClass(this.parentNode, activeClassName);
        }
        /**
         * Unset activeClassName from the parent node of the input.
         * We need to unset activeClassName only if the data was empty.
         * e.g. in the line style of the mk-contact-form, we set labels position based on activeClassName.
         */
        function unsetActiveClass() {
            if (this.value === '') {
                removeClass(this.parentNode, activeClassName);
            }
        }
        /**
         * Add event listeners (focus,blur) for input to set and unset activeClassName.
         *
         * @param input
         */
        function markActiveClass(input) {
            input.addEventListener('focus', setActiveClass);
            input.addEventListener('blur', unsetActiveClass);
        }
    }
    /**
     * Validate form when it's submitted. If everything was valid, we with post form in ajax request.
     *
     * @param e
     * @param invalidClassName
     */
    function validateForm(e, invalidClassName) {
        e.preventDefault();
        var form = e.target || e.srcElement;
        var inputs = getFormInputs(form);
        var isValidForm = true;
        var hasCaptchaField = false;
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            input.value = String(input.value).trim();
            switch (input.type) {
                case 'hidden':
                    break;
                case 'checkbox':
                    isValidForm = validateCheckBox(input, invalidClassName) && isValidForm;
                    break;
                case 'email':
                    isValidForm = validateEmail(input, invalidClassName) && isValidForm;
                    break;
                case 'textarea':
                    isValidForm = validateText(input, invalidClassName) && isValidForm;
                    break;
                case 'text':
                    /**
                     * Some old browsers such as IE 8 and 9 detect email type as text.
                     * So, we need to extra check for data-type attribute
                     */
                    if (input.dataset.type === 'captcha') {
                        isValidForm = validateText(input, invalidClassName) && isValidForm;
                        hasCaptchaField = true;
                    } else if (input.dataset.type === 'email') {
                        isValidForm = validateEmail(input, invalidClassName) && isValidForm;
                    } else {
                        isValidForm = validateText(input, invalidClassName) && isValidForm;
                    }
                    break;
                default:
                    /**
                     * e.g. validating for radiobox, selectbox and etc.
                     */
                    console.warn('Implement validation for ' + input.name + ':' + input.type);
                    break;
            }
        }
        if (isValidForm) {
            if (hasCaptchaField) {
                validateCaptcha(form, invalidClassName, sendForm);
            } else {
                sendForm(form);
            }
        }
    }
    /**
     * Validate captcha of form. If everything was, we will execute captchaIsValidCallback which as sendForm().
     *
     * @param form
     * @param invalidClassName
     * @param captchaIsValidCallback
     * @returns boolean
     */
    function validateCaptcha(form, invalidClassName, captchaIsValidCallback) {
        var input = form.querySelectorAll('[data-type="captcha"]')[0];
        if (input.value.length === 0) {
            addClass(input, invalidClassName);
            return false;
        } else {
          jQuery.get( jupiterDonutVars.ajaxUrl, {
            action: 'jupiter_donut_validate_captcha',
            nonce: jupiterDonutVars.nonce,
            captcha: input.value,
          })
          .done(function(data) {
            loadCaptcha();
            input.value = '';

            if ( data.success !== true ) {
                addClass(input, invalidClassName);
                addClass(input, 'contact-captcha-invalid');
                removeClass(input, 'contact-captcha-valid');
                input.placeholder = data.data;
            } else {
                removeClass(input, invalidClassName);
                removeClass(input, 'contact-captcha-invalid');
                addClass(input, 'contact-captcha-valid');
                input.placeholder = data.data;
                captchaIsValidCallback(form);
            }
          })
        }
    }
    /**
     * Send submitted form.
     *
     * @param form
     */
    function sendForm(form) {
        var $form = $(form);
        var data = getFormData(form);
        progressButton.loader($form);
        $.post(jupiterDonutVars.ajaxUrl, data, function(response) {
            var res = JSON.parse(response);
            if (res.action_Status) {
                progressButton.success($form);
                $form.find('.text-input').val('');
                $form.find('textarea').val('');
                $form.find('input[type=checkbox]').attr("checked", false);
                $form.find('.contact-form-message').slideDown().addClass('state-success').html(res.message);
                setTimeout(function() {
                   $form.find('.contact-form-message').slideUp();
                }, 5000);
            } else {
                progressButton.error($form);
                $form.find('.contact-form-message').removeClass('state-success').html(res.message);
            }
        });
    }
    /**
     * Initialize all captcha images for first time. All captcha images is always same. e.g. if we have multiple form,
     * all of them will have the same image.
     * It will also add event listener for '.captcha-change-image' objects to reload the captcha.
     */
    function initializeCaptchas() {
        var captchaChangeImageButtons = document.getElementsByClassName('captcha-change-image');
        for (var i = 0; i < captchaChangeImageButtons.length; i++) {
            captchaChangeImageButtons[i].addEventListener('click', loadCaptcha);
        }
    }
    /**
     * Load captcha text and append the image to captcha container.
     * If it used as a callback, it will prevent default behave of the event.
     * e.g. loading new captcha by click on <a> without changing url.
     */
    function loadCaptcha(e) {
        if (e) {
            e.preventDefault();
        }
        $.post(jupiterDonutVars.ajaxUrl, {
            action: 'mk_create_captcha_image'
        }, appendImage);
        /**
         * The callback function for append or change old image src based on response. T
         * The captchaImageURL is the url of the captcha which is provided in ajax response of mk_create_captcha_image.
         * @param captchaImageURL
         */
        function appendImage(captchaImageURL) {
            if (captchaImageHolder.find('.captcha-image').length === 0) {
                captchaImageHolder.html('<img src="' + captchaImageURL + '" class="captcha-image" alt="captcha txt">');
            } else {
                captchaImageHolder.find('.captcha-image').attr("src", captchaImageURL + '?' + new Date().getTime());
            }
        }
    }
    /**
     * Get form inputs using querySelectorAll().
     * It returns <input> and <textarea> tags. If you need any other tags such as <select>, please update this function.
     *
     * @param form
     * @returns {NodeList}
     */
    function getFormInputs(form) {
        return form.querySelectorAll('input,textarea');
    }
    /**
     * Get data of the form inputs and textareas as a object.
     *
     * @param form
     * @returns {{action: string}}
     */
    function getFormData(form) {
        var data = {
            action: 'mk_contact_form'
        };
        var inputs = getFormInputs(form);
        for (var i = 0; i < inputs.length; i++) {
            data[inputs[i].name] = inputs[i].value;
        }
        return data;
    }
}
/* Ajax Login Form */
/* -------------------------------------------------------------------- */
function mk_login_form() {
    $('form.mk-login-form').each(function() {
        var $this = $(this);
        $this.on('submit', function(e) {
            $('p.mk-login-status', $this).show().text(ajax_login_object.loadingmessage);
            $.ajax({
                type: 'POST',
                dataType: 'json',
                url: ajax_login_object.ajaxurl,
                data: {
                    'action': 'ajaxlogin',
                    'username': $('#username', $this).val(),
                    'password': $('#password', $this).val(),
                    'security': $('#security', $this).val()
                },
                success: function(data) {
                    $('p.mk-login-status', $this).text(data.message);
                    if (data.loggedin === true) {
                        document.location.href = ajax_login_object.redirecturl;
                    }
                }
            });
            e.preventDefault();
        });
    });
}
/* Progress Button */
/* -------------------------------------------------------------------- */
var progressButton = {
    loader: function(form) {
        MK.core.loadDependencies([MK.core.path.plugins + 'tweenmax.js'], function() {
            var $form = form,
                progressBar = $form.find(".mk-progress-button .mk-progress-inner"),
                buttonText = $form.find(".mk-progress-button .mk-progress-button-content"),
                progressButton = new TimelineLite();
            progressButton.to(progressBar, 0, {
                width: "100%",
                scaleX: 0,
                scaleY: 1
            }).to(buttonText, .3, {
                y: -5
            }).to(progressBar, 1.5, {
                scaleX: 1,
                ease: Power2.easeInOut
            }, "-=.1").to(buttonText, .3, {
                y: 0
            }).to(progressBar, .3, {
                scaleY: 0
            });
        });
    },
    success: function(form) {
        MK.core.loadDependencies([MK.core.path.plugins + 'tweenmax.js'], function() {
            var $form = form,
                buttonText = $form.find(".mk-button .mk-progress-button-content, .mk-contact-button .mk-progress-button-content"),
                successIcon = $form.find(".mk-progress-button .state-success"),
                progressButtonSuccess = new TimelineLite({
                    onComplete: hideSuccessMessage
                });
            progressButtonSuccess.to(buttonText, .3, {
                paddingRight: 20,
                ease: Power2.easeInOut
            }, "+=1").to(successIcon, .3, {
                opacity: 1
            }).to(successIcon, 2, {
                opacity: 1
            });

            function hideSuccessMessage() {
                progressButtonSuccess.reverse()
            }
        });
    },
    error: function(form) {
        MK.core.loadDependencies([MK.core.path.plugins + 'tweenmax.js'], function() {
            var $form = form,
                buttonText = $form.find(".mk-button .mk-progress-button-content, .mk-contact-button .mk-progress-button-content"),
                errorIcon = $form.find(".mk-progress-button .state-error"),
                progressButtonError = new TimelineLite({
                    onComplete: hideErrorMessage
                });
            progressButtonError.to(buttonText, .3, {
                paddingRight: 20
            }, "+=1").to(errorIcon, .3, {
                opacity: 1
            }).to(errorIcon, 2, {
                opacity: 1
            });

            function hideErrorMessage() {
                progressButtonError.reverse()
            }
        });
    }
};

/* Event Count Down */
/* -------------------------------------------------------------------- */

function mk_event_countdown() {
  if ($.exists('.mk-event-countdown')) {

    MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.countdown.js' ], function() {

      $('.mk-event-countdown').each(function () {
        var $this = $(this),
          $date = $this.attr('data-date'),
          $offset = $this.attr('data-offset');

        $this.downCount({
          date: $date,
          offset: $offset
        });
      });

    });
  }
}

/* Flexslider init */
/* -------------------------------------------------------------------- */

function mk_flexslider_init() {

  var $lcd = $('.mk-lcd-slideshow'),
      $laptop = $('.mk-laptop-slideshow-shortcode');

  if($lcd.length) $lcd.find('.mk-lcd-image').fadeIn();
  if($laptop.length) $laptop.find(".mk-laptop-image").fadeIn();

  $('.js-flexslider').each(function () {

    if ($(this).parents('.mk-tabs').length || $(this).parents('.mk-accordion').length) {
      $(this).removeData("flexslider");
    }

    var $this = $(this),
      $selector = $this.attr('data-selector'),
      $animation = $this.attr('data-animation'),
      $easing = $this.attr('data-easing'),
      $direction = $this.attr('data-direction'),
      $smoothHeight = $this.attr('data-smoothHeight') == "true" ? true : false,
      $slideshowSpeed = $this.attr('data-slideshowSpeed'),
      $animationSpeed = $this.attr('data-animationSpeed'),
      $controlNav = $this.attr('data-controlNav') == "true" ? true : false,
      $directionNav = $this.attr('data-directionNav') == "true" ? true : false,
      $pauseOnHover = $this.attr('data-pauseOnHover') == "true" ? true : false,
      $isCarousel = $this.attr('data-isCarousel') == "true" ? true : false;


    if ($selector !== undefined) {
      var $selector_class = $selector;
    } else {
      var $selector_class = ".mk-flex-slides > li";
    }

    if ($isCarousel === true) {
      var $itemWidth = parseInt($this.attr('data-itemWidth')),
        $itemMargin = parseInt($this.attr('data-itemMargin')),
        $minItems = parseInt($this.attr('data-minItems')),
        $maxItems = parseInt($this.attr('data-maxItems')),
        $move = parseInt($this.attr('data-move'));
    } else {
      var $itemWidth = $itemMargin = $minItems = $maxItems = $move = 0;
    }

    MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.flexslider.js' ], function() {
      $this.flexslider({
        selector: $selector_class,
        animation: $animation,
        easing: $easing,
        direction: $direction,
        smoothHeight: $smoothHeight,
        slideshow: true, // autoplay
        slideshowSpeed: $slideshowSpeed,
        animationSpeed: $animationSpeed,
        controlNav: $controlNav,
        directionNav: $directionNav,
        pauseOnHover: $pauseOnHover,
        prevText: "",
        nextText: "",
        itemWidth: $itemWidth,
        itemMargin: $itemMargin,
        minItems: $minItems,
        maxItems: $maxItems,
        move: $move
      });
    });

  });

}

(function( $ ) {
	'use strict';

	var val = MK.val;

	MK.component.FullHeight = function( el ) {
		var $window = $( window ),
			$this = $( el ),
			config = $this.data( 'fullheight-config' ),
			container = document.getElementById( 'mk-theme-container' ),
			minH = (config && config.min) ? config.min : 0,
			winH = null,
			height = null,
			update_count = 0,
			testing = MK.utils.getUrlParameter('testing'),
			offset = null;

		// We need to provide height on the same specificity level for workaround to IE bug
		// connect.microsoft.com/IE/feedback/details/802625/min-height-and-flexbox-flex-direction-column-dont-work-together-in-ie-10-11-preview
		// stackoverflow.com/questions/19371626/flexbox-not-centering-vertically-in-ie
		if(MK.utils.browser.name === ('IE' || 'Edge')) $this.css( 'height', '1px' );

		var update = function() {

			if(update_count === 0) {
				winH = $window.height();
				// for correct calculate
				offset = $this.offset().top - 1;
				height = Math.max(minH, winH - val.offsetHeaderHeight( offset ));
				$this.css( 'min-height', height );
				if(testing !== undefined )
				update_count++;
			}

		};

		// TODO remove scroll listener by dynamic offset reader
		var init = function() {
			update();
			$window.on( 'resize', update );
			$window.on( 'scroll', update );
			window.addResizeListener( container, update );
		};

		return {
			init : init
		};
	};

})( jQuery );


(function( $ ) {
	'use strict';

	var core  = MK.core,
		utils = MK.utils,
		path  = MK.core.path;


	MK.ui.FullScreenGallery = function( element, settings ) {
		this.element = element;
		this.config = settings;

		this.isFullScreen = false;
	};


	// preload slick PLUGIN TO USE THIS
	MK.ui.FullScreenGallery.prototype = {
		dom : {
			fullScrBtn 		: '.slick-full-screen',
			exitFullScrBtn 	: '.slick-minimize',
			playBtn 		: '.slick-play',
			pauseBtn 		: '.slick-pause',
			shareBtn 		: '.slick-share',
			socialShare 	: '.slick-social-share',
		    wrapper 		: '.slick-slider-wrapper',
			slider 			: '.slick-slides',
			slides 			: '.slick-slide',
			dots 			: '.slick-dot',
			active 			: '.slick-active',
			hiddenClass 	: 'jupiter-donut-is-hidden',
			dataId 			: 'slick-index'
		},

		tpl: {
			dot  : '<div class="slick-dot"></div>',
			next : '<a href="javascript:;" class="slick-next"> <svg width="33px" height="65px"> <polyline fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points=" 0.5,0.5 32.5,32.5 0.5,64.5"/> </svg> </a>',
			prev : '<a href="javascript:;" class="slick-prev"> <svg  width="33px" height="65px"> <polyline fill="none" stroke="#FFFFFF" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10" points=" 32.5,64.5 0.5,32.5 32.5,0.5"/> </svg> </a>'
		},

		init : function() {
			var self = this;

			// core.loadDependencies([ path.plugins + 'slick.js' ], function() {
				self.cacheElements();
				self.getViewportSizes();
				self.updateSizes( 'window' );
				self.create();
				// update cache with elements propagated by plugin
				self.updateCacheElements();
				self.createPagination();
				self.bindEvents();
			// });
		},

		create : function() {
			var self = this;

			this.slick = this.$gallery.slick({
		        dots: true,
		        arrows: true,
				infinite: true,
				speed: 300,
				slidesToShow: 1,
				centerMode: true,
				centerPadding: '0px',
				variableWidth: true,
				autoplay: false,
				autoplaySpeed: 3000,
        		useTransform: true,
                prevArrow: self.tpl.prev,
                nextArrow: self.tpl.next,
                customPaging: function(slider, i) {
                    return self.tpl.dot;
                },
			});
		},

		cacheElements : function() {
			this.$window = $( window );
			this.$gallery = $( this.element );

			this.$fullScrBtn = $( this.dom.fullScrBtn );
			this.$exitFullScrBtn = $( this.dom.exitFullScrBtn );
			this.$playBtn = $( this.dom.playBtn );
			this.$pauseBtn = $( this.dom.pauseBtn );
			this.$shareBtn = $( this.dom.shareBtn );
			this.$socialShare = $( this.dom.socialShare );

		    this.$wrapper = $( this.dom.wrapper );
			this.$slider = $( this.dom.slider );
			this.$slides = $( this.dom.slides );
			this.$imgs = this.$slides.find( 'img' );
			// store reference to initial images without slides appended by pugin
			// - needed for creating of pagination
			this.$originalImgs = this.$imgs;
		},

		updateCacheElements : function() {
			this.$slides = $( this.dom.slides );
			this.$imgs = this.$slides.find( 'img' );
			this.$dots = $( this.dom.dots );
		},

		bindEvents : function() {
			var self = this;
			this.$fullScrBtn.on( 'click', this.toFullScreen.bind( this ) );
			this.$exitFullScrBtn.on( 'click', this.exitFullScreen.bind( this ) );
			this.$playBtn.on( 'click', this.play.bind( this ) );
			this.$pauseBtn.on( 'click', this.pause.bind( this ) );
			this.$shareBtn.on( 'click', this.toggleShare.bind( this ) );
			this.$socialShare.on( 'click', 'a', this.socialShare.bind( this ) );
			this.$window.on( 'resize', this.onResize.bind( this ) );
			this.$window.on( 'keydown', function(e) {
				if(e.keyCode === 39) self.$gallery.slick('slickNext');
				if(e.keyCode === 37) self.$gallery.slick('slickPrev');
			});
			$( document ).on( 'fullscreenchange mozfullscreenchange webkitfullscreenchange msfullcreenchange', this.exitFullScreen.bind( this ) );
		},

		getViewportSizes : function() {
			this.screen = {
				w: screen.width,
				h: screen.height
			};
			this.window = {
				w: this.$window.width(),
				h: this.$window.height()
			};
		},

		updateSizes : function( viewport ) {
			this.$wrapper.width( this[ viewport ].w );
			this.$wrapper.height( '100%' );
			this.$imgs.height( '100%');
		},

		createPagination : function() {
			var self = this;
			this.$dots.each( function( i ) {
				var img = self.$originalImgs.eq( i ).attr( 'src' );

				$( this ).css({
					'background-image': 'url('+ img +')'
				});
			});
		},

		play : function(e) {
			e.preventDefault();
			this.$playBtn.addClass( this.dom.hiddenClass );
			this.$pauseBtn.removeClass( this.dom.hiddenClass );
			$( this.element ).slick( 'slickPlay' );
		},

		pause : function(e) {
			e.preventDefault();
			this.$pauseBtn.addClass( this.dom.hiddenClass );
			this.$playBtn.removeClass( this.dom.hiddenClass );
			$( this.element ).slick( 'slickPause' );
		},

		toggleShare : function(e) {
			e.preventDefault();
			this.$socialShare.toggleClass( this.dom.hiddenClass );
		},

		getCurentId : function() {
			return this.$slides.filter( this.dom.active ).data( this.dom.dataId );
		},

		toFullScreen : function() {
			var self = this;

			this.$fullScrBtn.addClass( this.dom.hiddenClass );
			this.$exitFullScrBtn.removeClass( this.dom.hiddenClass );

			this.$slider.hide().fadeIn( 500 );
			utils.launchIntoFullscreen( document.documentElement );
			this.updateSizes( 'screen' );
			$( this.element ).slick( 'slickGoTo', this.getCurentId(), true );

			// Update state with delay so we avoid triggering exitFullScreen fn from
			// fullscreenchange event
			setTimeout( function() {
				self.isFullScreen = true;
			}, 1000);
		},

		exitFullScreen : function() {
			if( this.isFullScreen ) {
				this.$exitFullScrBtn.addClass( this.dom.hiddenClass );
				this.$fullScrBtn.removeClass( this.dom.hiddenClass );

				utils.exitFullscreen();
				this.updateSizes( 'window' );
				$( this.element ).slick( 'slickGoTo', this.getCurentId(), true );

				this.isFullScreen = false;
			}

		},

		onResize : function() {
			this.getViewportSizes();
			this.updateSizes( this.isFullScreen ? 'screen' : 'window' );
			$( this.element ).slick( 'refresh' );
			$( this.element ).slick( 'slickGoTo', this.getCurentId(), true );
			this.updateCacheElements();
			this.createPagination();
		},

		socialShare : function( e ) {
			e.preventDefault();
			var $this = $( e.currentTarget ),
				network = $this.data( 'network' ),
				id = this.config.id,
				url = this.config.url,
				title = this.$wrapper.find( '.slick-title' ).text(),
				name;
				var picture = this.$slides.filter( this.dom.active ).children().first().attr( 'src' );
			switch( network ) {
				case 'facebook':
					url = 'https://www.facebook.com/sharer/sharer.php?picture=' + picture+'&u=' + url + '#id=' + id;
					name = 'Facebook Share';
					break;
				case 'twitter':
					url = 'http://twitter.com/intent/tweet?text=' + url + '#id=' + id;
					name = 'Twitter Share';
					break;
				case 'pinterest':
					url = 'http://pinterest.com/pin/create/bookmarklet/?media=' + picture + '&url=' + url + '&is_video=false&description=' + title;
					// other available link paranmeters: media, description
					name = 'Pinterest Share';
					break;

			}

       		window.open( url, name, "height=380 ,width=660, resizable=0, toolbar=0, menubar=0, status=0, location=0, scrollbars=0" );
		}
	};

})( jQuery );

(function($) {
    'use strict';

    MK.component.Grid = function( el ) {
    	var $container = $(el);
    	var config = $container.data( 'grid-config' );
        var isSlideshow = $container.closest('[data-mk-component="SwipeSlideshow"]').length;
        var miniGridConfig = {
            container: el,
            item: config.item + ':not(.is-hidden)',
            gutter: 0
        };

        var init = function init(){
            // Flags for cancelling usage goes first :
            // Quit early if we discover that Grid is used inside SwipeSlideshow as it brings bug with crossoverriding positioning
            // + grid is not really needed as we have single row all handled by slider.
            // It happens only in woocommerce carousel as of hardcoded Grid in loop-start.php
            if(isSlideshow) return;
	        MK.core.loadDependencies([ MK.core.path.plugins + 'minigrid.js' ], create);
        };

        // Remove el hidden without adding proper class
        var prepareForGrid = function prepareForGrid() {
            var $item = $(this);
            var isHidden = ($item.css('display') === 'none');
            if(isHidden) $item.addClass('is-hidden');
            else $item.removeClass('is-hidden');
        };

        var create = function create() {
            var timer = null;

	        function draw() {
                // Prevent plugin breaking when feeding it with hidden elements
                $container.find(config.item).each( prepareForGrid );
	            minigrid(miniGridConfig);
	        }

            function redraw() {
                if (timer) clearTimeout(timer);
                timer = setTimeout(draw, 100);
            }

            // init
	        draw();
            // If reinitializing drop existing event handler
            $(window).off('resize', redraw);
            $(window).on('resize mk-image-loaded', redraw);
            MK.utils.eventManager.subscribe('item-expanded', redraw);
            MK.utils.eventManager.subscribe('ajaxLoaded', redraw);
            MK.utils.eventManager.subscribe('staticFilter', redraw);
        };

        return {
         	init : init
        };
    };

})(jQuery);








/*!
 * imagesLoaded PACKAGED v4.1.1
 * JavaScript is all like "You images are done yet or what?"
 * MIT License
 */

!function(t,e){"function"==typeof define&&define.amd?define("ev-emitter/ev-emitter",e):"object"==typeof module&&module.exports?module.exports=e():t.EvEmitter=e()}("undefined"!=typeof window?window:this,function(){function t(){}var e=t.prototype;return e.on=function(t,e){if(t&&e){var i=this._events=this._events||{},n=i[t]=i[t]||[];return-1==n.indexOf(e)&&n.push(e),this}},e.once=function(t,e){if(t&&e){this.on(t,e);var i=this._onceEvents=this._onceEvents||{},n=i[t]=i[t]||{};return n[e]=!0,this}},e.off=function(t,e){var i=this._events&&this._events[t];if(i&&i.length){var n=i.indexOf(e);return-1!=n&&i.splice(n,1),this}},e.emitEvent=function(t,e){var i=this._events&&this._events[t];if(i&&i.length){var n=0,o=i[n];e=e||[];for(var r=this._onceEvents&&this._onceEvents[t];o;){var s=r&&r[o];s&&(this.off(t,o),delete r[o]),o.apply(this,e),n+=s?0:1,o=i[n]}return this}},t}),function(t,e){"use strict";"function"==typeof define&&define.amd?define(["ev-emitter/ev-emitter"],function(i){return e(t,i)}):"object"==typeof module&&module.exports?module.exports=e(t,require("ev-emitter")):t.imagesLoaded=e(t,t.EvEmitter)}(window,function(t,e){function i(t,e){for(var i in e)t[i]=e[i];return t}function n(t){var e=[];if(Array.isArray(t))e=t;else if("number"==typeof t.length)for(var i=0;i<t.length;i++)e.push(t[i]);else e.push(t);return e}function o(t,e,r){return this instanceof o?("string"==typeof t&&(t=document.querySelectorAll(t)),this.elements=n(t),this.options=i({},this.options),"function"==typeof e?r=e:i(this.options,e),r&&this.on("always",r),this.getImages(),h&&(this.jqDeferred=new h.Deferred),void setTimeout(function(){this.check()}.bind(this))):new o(t,e,r)}function r(t){this.img=t}function s(t,e){this.url=t,this.element=e,this.img=new Image}var h=t.jQuery,a=t.console;o.prototype=Object.create(e.prototype),o.prototype.options={},o.prototype.getImages=function(){this.images=[],this.elements.forEach(this.addElementImages,this)},o.prototype.addElementImages=function(t){"IMG"==t.nodeName&&this.addImage(t),this.options.background===!0&&this.addElementBackgroundImages(t);var e=t.nodeType;if(e&&d[e]){for(var i=t.querySelectorAll("img"),n=0;n<i.length;n++){var o=i[n];this.addImage(o)}if("string"==typeof this.options.background){var r=t.querySelectorAll(this.options.background);for(n=0;n<r.length;n++){var s=r[n];this.addElementBackgroundImages(s)}}}};var d={1:!0,9:!0,11:!0};return o.prototype.addElementBackgroundImages=function(t){var e=getComputedStyle(t);if(e)for(var i=/url\((['"])?(.*?)\1\)/gi,n=i.exec(e.backgroundImage);null!==n;){var o=n&&n[2];o&&this.addBackground(o,t),n=i.exec(e.backgroundImage)}},o.prototype.addImage=function(t){var e=new r(t);this.images.push(e)},o.prototype.addBackground=function(t,e){var i=new s(t,e);this.images.push(i)},o.prototype.check=function(){function t(t,i,n){setTimeout(function(){e.progress(t,i,n)})}var e=this;return this.progressedCount=0,this.hasAnyBroken=!1,this.images.length?void this.images.forEach(function(e){e.once("progress",t),e.check()}):void this.complete()},o.prototype.progress=function(t,e,i){this.progressedCount++,this.hasAnyBroken=this.hasAnyBroken||!t.isLoaded,this.emitEvent("progress",[this,t,e]),this.jqDeferred&&this.jqDeferred.notify&&this.jqDeferred.notify(this,t),this.progressedCount==this.images.length&&this.complete(),this.options.debug&&a&&a.log("progress: "+i,t,e)},o.prototype.complete=function(){var t=this.hasAnyBroken?"fail":"done";if(this.isComplete=!0,this.emitEvent(t,[this]),this.emitEvent("always",[this]),this.jqDeferred){var e=this.hasAnyBroken?"reject":"resolve";this.jqDeferred[e](this)}},r.prototype=Object.create(e.prototype),r.prototype.check=function(){var t=this.getIsImageComplete();return t?void this.confirm(0!==this.img.naturalWidth,"naturalWidth"):(this.proxyImage=new Image,this.proxyImage.addEventListener("load",this),this.proxyImage.addEventListener("error",this),this.img.addEventListener("load",this),this.img.addEventListener("error",this),void(this.proxyImage.src=this.img.src))},r.prototype.getIsImageComplete=function(){return this.img.complete&&void 0!==this.img.naturalWidth},r.prototype.confirm=function(t,e){this.isLoaded=t,this.emitEvent("progress",[this,this.img,e])},r.prototype.handleEvent=function(t){var e="on"+t.type;this[e]&&this[e](t)},r.prototype.onload=function(){this.confirm(!0,"onload"),this.unbindEvents()},r.prototype.onerror=function(){this.confirm(!1,"onerror"),this.unbindEvents()},r.prototype.unbindEvents=function(){this.proxyImage.removeEventListener("load",this),this.proxyImage.removeEventListener("error",this),this.img.removeEventListener("load",this),this.img.removeEventListener("error",this)},s.prototype=Object.create(r.prototype),s.prototype.check=function(){this.img.addEventListener("load",this),this.img.addEventListener("error",this),this.img.src=this.url;var t=this.getIsImageComplete();t&&(this.confirm(0!==this.img.naturalWidth,"naturalWidth"),this.unbindEvents())},s.prototype.unbindEvents=function(){this.img.removeEventListener("load",this),this.img.removeEventListener("error",this)},s.prototype.confirm=function(t,e){this.isLoaded=t,this.emitEvent("progress",[this,this.element,e])},o.makeJQueryPlugin=function(e){e=e||t.jQuery,e&&(h=e,h.fn.imagesLoaded=function(t,e){var i=new o(this,t,e);return i.jqDeferred.promise(h(this))})},o.makeJQueryPlugin(),o});

// ==================================================
// fancyBox v3.5.7
//
// Licensed GPLv3 for open source use
// or fancyBox Commercial License for commercial use
//
// http://fancyapps.com/fancybox/
// Copyright 2019 fancyApps
//
// ==================================================
!function(c,a,h,g){"use strict";var i,s,r,d,e,l,f,u,o,t,n,p,b;function m(t,e){var n,o,i,s=[],a=0;t&&t.isDefaultPrevented()||(t.preventDefault(),e=e||{},t&&t.data&&(e=u(t.data.options,e)),n=e.$target||h(t.currentTarget).trigger("blur"),(i=h.fancybox.getInstance())&&i.$trigger&&i.$trigger.is(n)||(s=e.selector?h(e.selector):(o=n.attr("data-fancybox")||"")?(s=t.data?t.data.items:[]).length?s.filter('[data-fancybox="'+o+'"]'):h('[data-fancybox="'+o+'"]'):[n],(a=h(s).index(n))<0&&(a=0),(i=h.fancybox.open(s,e,a)).$trigger=n))}c.console=c.console||{info:function(t){}},h&&(h.fn.fancybox?console.info("fancyBox already initialized"):(t={closeExisting:!1,loop:!1,gutter:50,keyboard:!0,preventCaptionOverlap:!0,arrows:!0,infobar:!0,smallBtn:"auto",toolbar:"auto",buttons:["zoom","slideShow","thumbs","close"],idleTime:3,protect:!1,modal:!1,image:{preload:!1},ajax:{settings:{data:{fancybox:!0}}},iframe:{tpl:'<iframe id="fancybox-frame{rnd}" name="fancybox-frame{rnd}" class="fancybox-iframe" allowfullscreen="allowfullscreen" allow="autoplay; fullscreen" src=""></iframe>',preload:!0,css:{},attr:{scrolling:"auto"}},video:{tpl:'<video class="fancybox-video" controls controlsList="nodownload" poster="{{poster}}"><source src="{{src}}" type="{{format}}" />Sorry, your browser doesn\'t support embedded videos, <a href="{{src}}">download</a> and watch with your favorite video player!</video>',format:"",autoStart:!0},defaultType:"image",animationEffect:"zoom",animationDuration:366,zoomOpacity:"auto",transitionEffect:"fade",transitionDuration:366,slideClass:"",baseClass:"",baseTpl:'<div class="fancybox-container" role="dialog" tabindex="-1"><div class="fancybox-bg"></div><div class="fancybox-inner"><div class="fancybox-infobar"><span data-fancybox-index></span>&nbsp;/&nbsp;<span data-fancybox-count></span></div><div class="fancybox-toolbar">{{buttons}}</div><div class="fancybox-navigation">{{arrows}}</div><div class="fancybox-stage"></div><div class="fancybox-caption"><div class="fancybox-caption__body"></div></div></div></div>',spinnerTpl:'<div class="fancybox-loading"></div>',errorTpl:'<div class="fancybox-error"><p>{{ERROR}}</p></div>',btnTpl:{download:'<a download data-fancybox-download class="fancybox-button fancybox-button--download" title="{{DOWNLOAD}}" href="javascript:;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18.62 17.09V19H5.38v-1.91zm-2.97-6.96L17 11.45l-5 4.87-5-4.87 1.36-1.32 2.68 2.64V5h1.92v7.77z"/></svg></a>',zoom:'<button data-fancybox-zoom class="fancybox-button fancybox-button--zoom" title="{{ZOOM}}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18.7 17.3l-3-3a5.9 5.9 0 0 0-.6-7.6 5.9 5.9 0 0 0-8.4 0 5.9 5.9 0 0 0 0 8.4 5.9 5.9 0 0 0 7.7.7l3 3a1 1 0 0 0 1.3 0c.4-.5.4-1 0-1.5zM8.1 13.8a4 4 0 0 1 0-5.7 4 4 0 0 1 5.7 0 4 4 0 0 1 0 5.7 4 4 0 0 1-5.7 0z"/></svg></button>',close:'<button data-fancybox-close class="fancybox-button fancybox-button--close" title="{{CLOSE}}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 10.6L6.6 5.2 5.2 6.6l5.4 5.4-5.4 5.4 1.4 1.4 5.4-5.4 5.4 5.4 1.4-1.4-5.4-5.4 5.4-5.4-1.4-1.4-5.4 5.4z"/></svg></button>',arrowLeft:'<button data-fancybox-prev class="fancybox-button fancybox-button--arrow_left" title="{{PREV}}"><div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11.28 15.7l-1.34 1.37L5 12l4.94-5.07 1.34 1.38-2.68 2.72H19v1.94H8.6z"/></svg></div></button>',arrowRight:'<button data-fancybox-next class="fancybox-button fancybox-button--arrow_right" title="{{NEXT}}"><div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15.4 12.97l-2.68 2.72 1.34 1.38L19 12l-4.94-5.07-1.34 1.38 2.68 2.72H5v1.94z"/></svg></div></button>',smallBtn:'<button type="button" data-fancybox-close class="fancybox-button fancybox-close-small" title="{{CLOSE}}"><svg xmlns="http://www.w3.org/2000/svg" version="1" viewBox="0 0 24 24"><path d="M13 12l5-5-1-1-5 5-5-5-1 1 5 5-5 5 1 1 5-5 5 5 1-1z"/></svg></button>'},parentEl:"body",hideScrollbar:!0,autoFocus:!0,backFocus:!0,trapFocus:!0,fullScreen:{autoStart:!1},touch:{vertical:!0,momentum:!0},hash:null,media:{},slideShow:{autoStart:!1,speed:3e3},thumbs:{autoStart:!1,hideOnClose:!0,parentEl:".fancybox-container",axis:"y"},wheel:"auto",onInit:h.noop,beforeLoad:h.noop,afterLoad:h.noop,beforeShow:h.noop,afterShow:h.noop,beforeClose:h.noop,afterClose:h.noop,onActivate:h.noop,onDeactivate:h.noop,clickContent:function(t,e){return"image"===t.type&&"zoom"},clickSlide:"close",clickOutside:"close",dblclickContent:!1,dblclickSlide:!1,dblclickOutside:!1,mobile:{preventCaptionOverlap:!1,idleTime:!1,clickContent:function(t,e){return"image"===t.type&&"toggleControls"},clickSlide:function(t,e){return"image"===t.type?"toggleControls":"close"},dblclickContent:function(t,e){return"image"===t.type&&"zoom"},dblclickSlide:function(t,e){return"image"===t.type&&"zoom"}},lang:"en",i18n:{en:{CLOSE:"Close",NEXT:"Next",PREV:"Previous",ERROR:"The requested content cannot be loaded. <br/> Please try again later.",PLAY_START:"Start slideshow",PLAY_STOP:"Pause slideshow",FULL_SCREEN:"Full screen",THUMBS:"Thumbnails",DOWNLOAD:"Download",SHARE:"Share",ZOOM:"Zoom"},de:{CLOSE:"Schlie&szlig;en",NEXT:"Weiter",PREV:"Zur&uuml;ck",ERROR:"Die angeforderten Daten konnten nicht geladen werden. <br/> Bitte versuchen Sie es sp&auml;ter nochmal.",PLAY_START:"Diaschau starten",PLAY_STOP:"Diaschau beenden",FULL_SCREEN:"Vollbild",THUMBS:"Vorschaubilder",DOWNLOAD:"Herunterladen",SHARE:"Teilen",ZOOM:"Vergr&ouml;&szlig;ern"}}},i=h(c),s=h(a),r=0,d=c.requestAnimationFrame||c.webkitRequestAnimationFrame||c.mozRequestAnimationFrame||c.oRequestAnimationFrame||function(t){return c.setTimeout(t,1e3/60)},e=c.cancelAnimationFrame||c.webkitCancelAnimationFrame||c.mozCancelAnimationFrame||c.oCancelAnimationFrame||function(t){c.clearTimeout(t)},l=function(){var t,e=a.createElement("fakeelement"),n={transition:"transitionend",OTransition:"oTransitionEnd",MozTransition:"transitionend",WebkitTransition:"webkitTransitionEnd"};for(t in n)if(e.style[t]!==g)return n[t];return"transitionend"}(),f=function(t){return t&&t.length&&t[0].offsetHeight},u=function(t,e){var n=h.extend(!0,{},t,e);return h.each(e,function(t,e){h.isArray(e)&&(n[t]=e)}),n},o=function(t,e,n){var o=this;o.opts=u({index:n},h.fancybox.defaults),h.isPlainObject(e)&&(o.opts=u(o.opts,e)),h.fancybox.isMobile&&(o.opts=u(o.opts,o.opts.mobile)),o.id=o.opts.id||++r,o.currIndex=parseInt(o.opts.index,10)||0,o.prevIndex=null,o.prevPos=null,o.currPos=0,o.firstRun=!0,o.group=[],o.slides={},o.addContent(t),o.group.length&&o.init()},h.extend(o.prototype,{init:function(){var e,n,o=this,i=o.group[o.currIndex].opts;i.closeExisting&&h.fancybox.close(!0),h("body").addClass("fancybox-active"),!h.fancybox.getInstance()&&!1!==i.hideScrollbar&&!h.fancybox.isMobile&&a.body.scrollHeight>c.innerHeight&&(h("head").append('<style id="fancybox-style-noscroll" type="text/css">.compensate-for-scrollbar{margin-right:'+(c.innerWidth-a.documentElement.clientWidth)+"px;}</style>"),h("body").addClass("compensate-for-scrollbar")),n="",h.each(i.buttons,function(t,e){n+=i.btnTpl[e]||""}),e=h(o.translate(o,i.baseTpl.replace("{{buttons}}",n).replace("{{arrows}}",i.btnTpl.arrowLeft+i.btnTpl.arrowRight))).attr("id","fancybox-container-"+o.id).addClass(i.baseClass).data("FancyBox",o).appendTo(i.parentEl),o.$refs={container:e},["bg","inner","infobar","toolbar","stage","caption","navigation"].forEach(function(t){o.$refs[t]=e.find(".fancybox-"+t)}),o.trigger("onInit"),o.activate(),o.jumpTo(o.currIndex)},translate:function(t,e){var n=t.opts.i18n[t.opts.lang]||t.opts.i18n.en;return e.replace(/\{\{(\w+)\}\}/g,function(t,e){return n[e]===g?t:n[e]})},addContent:function(t){var r=this,t=h.makeArray(t);h.each(t,function(t,e){var n,o,i,s={},a={};h.isPlainObject(e)?a=(s=e).opts||e:"object"===h.type(e)&&h(e).length?(a=(o=h(e)).data()||{},(a=h.extend(!0,{},a,a.options)).$orig=o,s.src=r.opts.src||a.src||o.attr("href"),s.type||s.src||(s.type="inline",s.src=e)):s={type:"html",src:e+""},s.opts=h.extend(!0,{},r.opts,a),h.isArray(a.buttons)&&(s.opts.buttons=a.buttons),h.fancybox.isMobile&&s.opts.mobile&&(s.opts=u(s.opts,s.opts.mobile)),n=s.type||s.opts.type,o=s.src||"",!n&&o&&((a=o.match(/\.(mp4|mov|ogv|webm)((\?|#).*)?$/i))?(n="video",s.opts.video.format||(s.opts.video.format="video/"+("ogv"===a[1]?"ogg":a[1]))):o.match(/(^data:image\/[a-z0-9+\/=]*,)|(\.(jp(e|g|eg)|gif|png|bmp|webp|svg|ico)((\?|#).*)?$)/i)?n="image":o.match(/\.(pdf)((\?|#).*)?$/i)?(n="iframe",s=h.extend(!0,s,{contentType:"pdf",opts:{iframe:{preload:!1}}})):"#"===o.charAt(0)&&(n="inline")),n?s.type=n:r.trigger("objectNeedsType",s),s.contentType||(s.contentType=-1<h.inArray(s.type,["html","inline","ajax"])?"html":s.type),s.index=r.group.length,"auto"==s.opts.smallBtn&&(s.opts.smallBtn=-1<h.inArray(s.type,["html","inline","ajax"])),"auto"===s.opts.toolbar&&(s.opts.toolbar=!s.opts.smallBtn),s.$thumb=s.opts.$thumb||null,s.opts.$trigger&&s.index===r.opts.index&&(s.$thumb=s.opts.$trigger.find("img:first"),s.$thumb.length&&(s.opts.$orig=s.opts.$trigger)),s.$thumb&&s.$thumb.length||!s.opts.$orig||(s.$thumb=s.opts.$orig.find("img:first")),s.$thumb&&!s.$thumb.length&&(s.$thumb=null),s.thumb=s.opts.thumb||(s.$thumb?s.$thumb[0].src:null),"function"===h.type(s.opts.caption)&&(s.opts.caption=s.opts.caption.apply(e,[r,s])),"function"===h.type(r.opts.caption)&&(s.opts.caption=r.opts.caption.apply(e,[r,s])),s.opts.caption instanceof h||(s.opts.caption=s.opts.caption===g?"":s.opts.caption+""),"ajax"===s.type&&1<(i=o.split(/\s+/,2)).length&&(s.src=i.shift(),s.opts.filter=i.shift()),s.opts.modal&&(s.opts=h.extend(!0,s.opts,{trapFocus:!0,infobar:0,toolbar:0,smallBtn:0,keyboard:0,slideShow:0,fullScreen:0,thumbs:0,touch:0,clickContent:!1,clickSlide:!1,clickOutside:!1,dblclickContent:!1,dblclickSlide:!1,dblclickOutside:!1})),r.group.push(s)}),Object.keys(r.slides).length&&(r.updateControls(),(t=r.Thumbs)&&t.isActive&&(t.create(),t.focus()))},addEvents:function(){var o=this;o.removeEvents(),o.$refs.container.on("click.fb-close","[data-fancybox-close]",function(t){t.stopPropagation(),t.preventDefault(),o.close(t)}).on("touchstart.fb-prev click.fb-prev","[data-fancybox-prev]",function(t){t.stopPropagation(),t.preventDefault(),o.previous()}).on("touchstart.fb-next click.fb-next","[data-fancybox-next]",function(t){t.stopPropagation(),t.preventDefault(),o.next()}).on("click.fb","[data-fancybox-zoom]",function(t){o[o.isScaledDown()?"scaleToActual":"scaleToFit"]()}),i.on("orientationchange.fb resize.fb",function(t){t&&t.originalEvent&&"resize"===t.originalEvent.type?(o.requestId&&e(o.requestId),o.requestId=d(function(){o.update(t)})):(o.current&&"iframe"===o.current.type&&o.$refs.stage.hide(),setTimeout(function(){o.$refs.stage.show(),o.update(t)},h.fancybox.isMobile?600:250))}),s.on("keydown.fb",function(t){var e=(h.fancybox?h.fancybox.getInstance():null).current,n=t.keyCode||t.which;if(9!=n){if(!(!e.opts.keyboard||t.ctrlKey||t.altKey||t.shiftKey||h(t.target).is("input,textarea,video,audio,select")))return 8===n||27===n?(t.preventDefault(),void o.close(t)):37===n||38===n?(t.preventDefault(),void o.previous()):39===n||40===n?(t.preventDefault(),void o.next()):void o.trigger("afterKeydown",t,n)}else e.opts.trapFocus&&o.focus(t)}),o.group[o.currIndex].opts.idleTime&&(o.idleSecondsCounter=0,s.on("mousemove.fb-idle mouseleave.fb-idle mousedown.fb-idle touchstart.fb-idle touchmove.fb-idle scroll.fb-idle keydown.fb-idle",function(t){o.idleSecondsCounter=0,o.isIdle&&o.showControls(),o.isIdle=!1}),o.idleInterval=c.setInterval(function(){o.idleSecondsCounter++,o.idleSecondsCounter>=o.group[o.currIndex].opts.idleTime&&!o.isDragging&&(o.isIdle=!0,o.idleSecondsCounter=0,o.hideControls())},1e3))},removeEvents:function(){i.off("orientationchange.fb resize.fb"),s.off("keydown.fb .fb-idle"),this.$refs.container.off(".fb-close .fb-prev .fb-next"),this.idleInterval&&(c.clearInterval(this.idleInterval),this.idleInterval=null)},previous:function(t){return this.jumpTo(this.currPos-1,t)},next:function(t){return this.jumpTo(this.currPos+1,t)},jumpTo:function(t,o){var e,n,i,s,a,r,c,l,d=this,u=d.group.length;if(!(d.isDragging||d.isClosing||d.isAnimating&&d.firstRun))return t=parseInt(t,10),!(!(n=(d.current||d).opts.loop)&&(t<0||u<=t))&&(e=d.firstRun=!Object.keys(d.slides).length,s=d.current,d.prevIndex=d.currIndex,d.prevPos=d.currPos,i=d.createSlide(t),1<u&&((n||i.index<u-1)&&d.createSlide(t+1),(n||0<i.index)&&d.createSlide(t-1)),d.current=i,d.currIndex=i.index,d.currPos=i.pos,d.trigger("beforeShow",e),d.updateControls(),i.forcedDuration=g,h.isNumeric(o)?i.forcedDuration=o:o=i.opts[e?"animationDuration":"transitionDuration"],o=parseInt(o,10),t=d.isMoved(i),i.$slide.addClass("fancybox-slide--current"),e?(i.opts.animationEffect&&o&&d.$refs.container.css("transition-duration",o+"ms"),d.$refs.container.addClass("fancybox-is-open").trigger("focus"),d.loadSlide(i)):(a=h.fancybox.getTranslate(s.$slide),r=h.fancybox.getTranslate(d.$refs.stage),h.each(d.slides,function(t,e){h.fancybox.stop(e.$slide,!0)}),s.pos!==i.pos&&(s.isComplete=!1),s.$slide.removeClass("fancybox-slide--complete fancybox-slide--current"),t?(l=a.left-(s.pos*a.width+s.pos*s.opts.gutter),h.each(d.slides,function(t,e){e.$slide.removeClass("fancybox-animated").removeClass(function(t,e){return(e.match(/(^|\s)fancybox-fx-\S+/g)||[]).join(" ")});var n=e.pos*a.width+e.pos*e.opts.gutter;h.fancybox.setTranslate(e.$slide,{top:0,left:n-r.left+l}),e.pos!==i.pos&&e.$slide.addClass("fancybox-slide--"+(e.pos>i.pos?"next":"previous")),f(e.$slide),h.fancybox.animate(e.$slide,{top:0,left:(e.pos-i.pos)*a.width+(e.pos-i.pos)*e.opts.gutter},o,function(){e.$slide.css({transform:"",opacity:""}).removeClass("fancybox-slide--next fancybox-slide--previous"),e.pos===d.currPos&&d.complete()})})):o&&i.opts.transitionEffect&&(c="fancybox-animated fancybox-fx-"+i.opts.transitionEffect,s.$slide.addClass("fancybox-slide--"+(s.pos>i.pos?"next":"previous")),h.fancybox.animate(s.$slide,c,o,function(){s.$slide.removeClass(c).removeClass("fancybox-slide--next fancybox-slide--previous")},!1)),i.isLoaded?d.revealContent(i):d.loadSlide(i)),void d.preload("image"))},createSlide:function(t){var e,n=this,o=t%n.group.length;return o=o<0?n.group.length+o:o,!n.slides[t]&&n.group[o]&&(e=h('<div class="fancybox-slide"></div>').appendTo(n.$refs.stage),n.slides[t]=h.extend(!0,{},n.group[o],{pos:t,$slide:e,isLoaded:!1}),n.updateSlide(n.slides[t])),n.slides[t]},scaleToActual:function(t,e,n){var o,i,s,a,r=this,c=r.current,l=c.$content,d=h.fancybox.getTranslate(c.$slide).width,u=h.fancybox.getTranslate(c.$slide).height,f=c.width,p=c.height;r.isAnimating||r.isMoved()||!l||"image"!=c.type||!c.isLoaded||c.hasError||(r.isAnimating=!0,h.fancybox.stop(l),t=t===g?.5*d:t,e=e===g?.5*u:e,(o=h.fancybox.getTranslate(l)).top-=h.fancybox.getTranslate(c.$slide).top,o.left-=h.fancybox.getTranslate(c.$slide).left,s=f/o.width,a=p/o.height,i=.5*d-.5*f,c=.5*u-.5*p,d<f&&(0<(i=o.left*s-(t*s-t))&&(i=0),i<d-f&&(i=d-f)),u<p&&(0<(c=o.top*a-(e*a-e))&&(c=0),c<u-p&&(c=u-p)),r.updateCursor(f,p),h.fancybox.animate(l,{top:c,left:i,scaleX:s,scaleY:a},n||366,function(){r.isAnimating=!1}),r.SlideShow&&r.SlideShow.isActive&&r.SlideShow.stop())},scaleToFit:function(t){var e=this,n=e.current,o=n.$content;e.isAnimating||e.isMoved()||!o||"image"!=n.type||!n.isLoaded||n.hasError||(e.isAnimating=!0,h.fancybox.stop(o),n=e.getFitPos(n),e.updateCursor(n.width,n.height),h.fancybox.animate(o,{top:n.top,left:n.left,scaleX:n.width/o.width(),scaleY:n.height/o.height()},t||366,function(){e.isAnimating=!1}))},getFitPos:function(t){var e,n,o=t.$content,i=t.$slide,s=t.width||t.opts.width,a=t.height||t.opts.height,r={};return!!(t.isLoaded&&o&&o.length)&&(e=h.fancybox.getTranslate(this.$refs.stage).width,n=h.fancybox.getTranslate(this.$refs.stage).height,e-=parseFloat(i.css("paddingLeft"))+parseFloat(i.css("paddingRight"))+parseFloat(o.css("marginLeft"))+parseFloat(o.css("marginRight")),n-=parseFloat(i.css("paddingTop"))+parseFloat(i.css("paddingBottom"))+parseFloat(o.css("marginTop"))+parseFloat(o.css("marginBottom")),s&&a||(s=e,a=n),e-.5<(s*=o=Math.min(1,e/s,n/a))&&(s=e),n-.5<(a*=o)&&(a=n),"image"===t.type?(r.top=Math.floor(.5*(n-a))+parseFloat(i.css("paddingTop")),r.left=Math.floor(.5*(e-s))+parseFloat(i.css("paddingLeft"))):"video"===t.contentType&&(s/(t=t.opts.width&&t.opts.height?s/a:t.opts.ratio||16/9)<a?a=s/t:a*t<s&&(s=a*t)),r.width=s,r.height=a,r)},update:function(n){var o=this;h.each(o.slides,function(t,e){o.updateSlide(e,n)})},updateSlide:function(t,e){var n=this,o=t&&t.$content,i=t.width||t.opts.width,s=t.height||t.opts.height,a=t.$slide;n.adjustCaption(t),o&&(i||s||"video"===t.contentType)&&!t.hasError&&(h.fancybox.stop(o),h.fancybox.setTranslate(o,n.getFitPos(t)),t.pos===n.currPos&&(n.isAnimating=!1,n.updateCursor())),n.adjustLayout(t),a.length&&(a.trigger("refresh"),t.pos===n.currPos&&n.$refs.toolbar.add(n.$refs.navigation.find(".fancybox-button--arrow_right")).toggleClass("compensate-for-scrollbar",a.get(0).scrollHeight>a.get(0).clientHeight)),n.trigger("onUpdate",t,e)},centerSlide:function(t){var e=this,n=e.current,o=n.$slide;!e.isClosing&&n&&(o.siblings().css({transform:"",opacity:""}),o.parent().children().removeClass("fancybox-slide--previous fancybox-slide--next"),h.fancybox.animate(o,{top:0,left:0,opacity:1},t===g?0:t,function(){o.css({transform:"",opacity:""}),n.isComplete||e.complete()},!1))},isMoved:function(t){var e,n=t||this.current;return!!n&&(e=h.fancybox.getTranslate(this.$refs.stage),t=h.fancybox.getTranslate(n.$slide),!n.$slide.hasClass("fancybox-animated")&&(.5<Math.abs(t.top-e.top)||.5<Math.abs(t.left-e.left)))},updateCursor:function(t,e){var n=this,o=n.current,i=n.$refs.container;o&&!n.isClosing&&n.Guestures&&(i.removeClass("fancybox-is-zoomable fancybox-can-zoomIn fancybox-can-zoomOut fancybox-can-swipe fancybox-can-pan"),e=!!(t=n.canPan(t,e))||n.isZoomable(),i.toggleClass("fancybox-is-zoomable",e),h("[data-fancybox-zoom]").prop("disabled",!e),t?i.addClass("fancybox-can-pan"):e&&("zoom"===o.opts.clickContent||h.isFunction(o.opts.clickContent)&&"zoom"==o.opts.clickContent(o))?i.addClass("fancybox-can-zoomIn"):o.opts.touch&&(o.opts.touch.vertical||1<n.group.length)&&"video"!==o.contentType&&i.addClass("fancybox-can-swipe"))},isZoomable:function(){var t,e=this.current;if(e&&!this.isClosing&&"image"===e.type&&!e.hasError){if(!e.isLoaded)return!0;if((t=this.getFitPos(e))&&(e.width>t.width||e.height>t.height))return!0}return!1},isScaledDown:function(t,e){var n=!1,o=this.current,i=o.$content;return t!==g&&e!==g?n=t<o.width&&e<o.height:i&&(n=(n=h.fancybox.getTranslate(i)).width<o.width&&n.height<o.height),n},canPan:function(t,e){var n=this.current,o=null,i=!1;return"image"===n.type&&(n.isComplete||t&&e)&&!n.hasError&&(i=this.getFitPos(n),t!==g&&e!==g?o={width:t,height:e}:n.isComplete&&(o=h.fancybox.getTranslate(n.$content)),o&&i&&(i=1.5<Math.abs(o.width-i.width)||1.5<Math.abs(o.height-i.height))),i},loadSlide:function(n){var t,e,o,i=this;if(!n.isLoading&&!n.isLoaded){if(!(n.isLoading=!0)===i.trigger("beforeLoad",n))return n.isLoading=!1;switch(t=n.type,(e=n.$slide).off("refresh").trigger("onReset").addClass(n.opts.slideClass),t){case"image":i.setImage(n);break;case"iframe":i.setIframe(n);break;case"html":i.setContent(n,n.src||n.content);break;case"video":i.setContent(n,n.opts.video.tpl.replace(/\{\{src\}\}/gi,n.src).replace("{{format}}",n.opts.videoFormat||n.opts.video.format||"").replace("{{poster}}",n.thumb||""));break;case"inline":h(n.src).length?i.setContent(n,h(n.src)):i.setError(n);break;case"ajax":i.showLoading(n),o=h.ajax(h.extend({},n.opts.ajax.settings,{url:n.src,success:function(t,e){"success"===e&&i.setContent(n,t)},error:function(t,e){t&&"abort"!==e&&i.setError(n)}})),e.one("onReset",function(){o.abort()});break;default:i.setError(n)}return!0}},setImage:function(e){var t,n=this;setTimeout(function(){var t=e.$image;n.isClosing||!e.isLoading||t&&t.length&&t[0].complete||e.hasError||n.showLoading(e)},50),n.checkSrcset(e),e.$content=h('<div class="fancybox-content"></div>').addClass("fancybox-is-hidden").appendTo(e.$slide.addClass("fancybox-slide--image")),!1!==e.opts.preload&&e.opts.width&&e.opts.height&&e.thumb&&(e.width=e.opts.width,e.height=e.opts.height,(t=a.createElement("img")).onerror=function(){h(this).remove(),e.$ghost=null},t.onload=function(){n.afterLoad(e)},e.$ghost=h(t).addClass("fancybox-image").appendTo(e.$content).attr("src",e.thumb)),n.setBigImage(e)},checkSrcset:function(t){var e,n,o,i,s=t.opts.srcset||t.opts.image.srcset;if(s){o=c.devicePixelRatio||1,i=c.innerWidth*o,(n=s.split(",").map(function(t){var o={};return t.trim().split(/\s+/).forEach(function(t,e){var n=parseInt(t.substring(0,t.length-1),10);if(0===e)return o.url=t;n&&(o.value=n,o.postfix=t[t.length-1])}),o})).sort(function(t,e){return t.value-e.value});for(var a=0;a<n.length;a++){var r=n[a];if("w"===r.postfix&&r.value>=i||"x"===r.postfix&&r.value>=o){e=r;break}}!e&&n.length&&(e=n[n.length-1]),e&&(t.src=e.url,t.width&&t.height&&"w"==e.postfix&&(t.height=t.width/t.height*e.value,t.width=e.value),t.opts.srcset=s)}},setBigImage:function(e){var n=this,t=a.createElement("img"),o=h(t);e.$image=o.one("error",function(){n.setError(e)}).one("load",function(){var t;e.$ghost||(n.resolveImageSlideSize(e,this.naturalWidth,this.naturalHeight),n.afterLoad(e)),n.isClosing||(e.opts.srcset&&((t=e.opts.sizes)&&"auto"!==t||(t=(1<e.width/e.height&&1<i.width()/i.height()?"100":Math.round(e.width/e.height*100))+"vw"),o.attr("sizes",t).attr("srcset",e.opts.srcset)),e.$ghost&&setTimeout(function(){e.$ghost&&!n.isClosing&&e.$ghost.hide()},Math.min(300,Math.max(1e3,e.height/1600))),n.hideLoading(e))}).addClass("fancybox-image").attr("src",e.src).appendTo(e.$content),(t.complete||"complete"==t.readyState)&&o.naturalWidth&&o.naturalHeight?o.trigger("load"):t.error&&o.trigger("error")},resolveImageSlideSize:function(t,e,n){var o=parseInt(t.opts.width,10),i=parseInt(t.opts.height,10);t.width=e,t.height=n,0<o&&(t.width=o,t.height=Math.floor(o*n/e)),0<i&&(t.width=Math.floor(i*e/n),t.height=i)},setIframe:function(i){var s,e=this,a=i.opts.iframe,r=i.$slide;i.$content=h('<div class="fancybox-content'+(a.preload?" fancybox-is-hidden":"")+'"></div>').css(a.css).appendTo(r),r.addClass("fancybox-slide--"+i.contentType),i.$iframe=s=h(a.tpl.replace(/\{rnd\}/g,(new Date).getTime())).attr(a.attr).appendTo(i.$content),a.preload?(e.showLoading(i),s.on("load.fb error.fb",function(t){this.isReady=1,i.$slide.trigger("refresh"),e.afterLoad(i)}),r.on("refresh.fb",function(){var t,e=i.$content,n=a.css.width,o=a.css.height;if(1===s[0].isReady){try{t=s.contents().find("body")}catch(t){}t&&t.length&&t.children().length&&(r.css("overflow","visible"),e.css({width:"100%","max-width":"100%",height:"9999px"}),n===g&&(n=Math.ceil(Math.max(t[0].clientWidth,t.outerWidth(!0)))),e.css("width",n||"").css("max-width",""),o===g&&(o=Math.ceil(Math.max(t[0].clientHeight,t.outerHeight(!0)))),e.css("height",o||""),r.css("overflow","auto")),e.removeClass("fancybox-is-hidden")}})):e.afterLoad(i),s.attr("src",i.src),r.one("onReset",function(){try{h(this).find("iframe").hide().unbind().attr("src","//about:blank")}catch(t){}h(this).off("refresh.fb").empty(),i.isLoaded=!1,i.isRevealed=!1})},setContent:function(t,e){var n;this.isClosing||(this.hideLoading(t),t.$content&&h.fancybox.stop(t.$content),t.$slide.empty(),(n=e)&&n.hasOwnProperty&&n instanceof h&&e.parent().length?((e.hasClass("fancybox-content")||e.parent().hasClass("fancybox-content"))&&e.parents(".fancybox-slide").trigger("onReset"),t.$placeholder=h("<div>").hide().insertAfter(e),e.css("display","inline-block")):t.hasError||("string"===h.type(e)&&(e=h("<div>").append(h.trim(e)).contents()),t.opts.filter&&(e=h("<div>").html(e).find(t.opts.filter))),t.$slide.one("onReset",function(){h(this).find("video,audio").trigger("pause"),t.$placeholder&&(t.$placeholder.after(e.removeClass("fancybox-content").hide()).remove(),t.$placeholder=null),t.$smallBtn&&(t.$smallBtn.remove(),t.$smallBtn=null),t.hasError||(h(this).empty(),t.isLoaded=!1,t.isRevealed=!1)}),h(e).appendTo(t.$slide),h(e).is("video,audio")&&(h(e).addClass("fancybox-video"),h(e).wrap("<div></div>"),t.contentType="video",t.opts.width=t.opts.width||h(e).attr("width"),t.opts.height=t.opts.height||h(e).attr("height")),t.$content=t.$slide.children().filter("div,form,main,video,audio,article,.fancybox-content").first(),t.$content.siblings().hide(),t.$content.length||(t.$content=t.$slide.wrapInner("<div></div>").children().first()),t.$content.addClass("fancybox-content"),t.$slide.addClass("fancybox-slide--"+t.contentType),this.afterLoad(t))},setError:function(t){t.hasError=!0,t.$slide.trigger("onReset").removeClass("fancybox-slide--"+t.contentType).addClass("fancybox-slide--error"),t.contentType="html",this.setContent(t,this.translate(t,t.opts.errorTpl)),t.pos===this.currPos&&(this.isAnimating=!1)},showLoading:function(t){(t=t||this.current)&&!t.$spinner&&(t.$spinner=h(this.translate(this,this.opts.spinnerTpl)).appendTo(t.$slide).hide().fadeIn("fast"))},hideLoading:function(t){(t=t||this.current)&&t.$spinner&&(t.$spinner.stop().remove(),delete t.$spinner)},afterLoad:function(t){var e=this;e.isClosing||(t.isLoading=!1,t.isLoaded=!0,e.trigger("afterLoad",t),e.hideLoading(t),!t.opts.smallBtn||t.$smallBtn&&t.$smallBtn.length||(t.$smallBtn=h(e.translate(t,t.opts.btnTpl.smallBtn)).appendTo(t.$content)),t.opts.protect&&t.$content&&!t.hasError&&(t.$content.on("contextmenu.fb",function(t){return 2==t.button&&t.preventDefault(),!0}),"image"===t.type&&h('<div class="fancybox-spaceball"></div>').appendTo(t.$content)),e.adjustCaption(t),e.adjustLayout(t),t.pos===e.currPos&&e.updateCursor(),e.revealContent(t))},adjustCaption:function(t){var e=this,n=t||e.current,o=n.opts.caption,i=n.opts.preventCaptionOverlap,s=e.$refs.caption,t=!1;s.toggleClass("fancybox-caption--separate",i),i&&o&&o.length&&(n.pos!==e.currPos?((s=s.clone().appendTo(s.parent())).children().eq(0).empty().html(o),t=s.outerHeight(!0),s.empty().remove()):e.$caption&&(t=e.$caption.outerHeight(!0)),n.$slide.css("padding-bottom",t||""))},adjustLayout:function(t){var e,n,o,i=t||this.current;i.isLoaded&&!0!==i.opts.disableLayoutFix&&(i.$content.css("margin-bottom",""),i.$content.outerHeight()>i.$slide.height()+.5&&(n=i.$slide[0].style["padding-bottom"],o=i.$slide.css("padding-bottom"),0<parseFloat(o)&&(t=i.$slide[0].scrollHeight,i.$slide.css("padding-bottom",0),Math.abs(t-i.$slide[0].scrollHeight)<1&&(e=o),i.$slide.css("padding-bottom",n))),i.$content.css("margin-bottom",e))},revealContent:function(t){var e,n,o,i,s=this,a=t.$slide,r=!1,c=!1,l=s.isMoved(t),d=t.isRevealed;return t.isRevealed=!0,e=t.opts[s.firstRun?"animationEffect":"transitionEffect"],o=t.opts[s.firstRun?"animationDuration":"transitionDuration"],o=parseInt(t.forcedDuration===g?o:t.forcedDuration,10),!l&&t.pos===s.currPos&&o||(e=!1),"zoom"===e&&(t.pos===s.currPos&&o&&"image"===t.type&&!t.hasError&&(c=s.getThumbPos(t))?r=s.getFitPos(t):e="fade"),"zoom"===e?(s.isAnimating=!0,r.scaleX=r.width/c.width,r.scaleY=r.height/c.height,"auto"==(i=t.opts.zoomOpacity)&&(i=.1<Math.abs(t.width/t.height-c.width/c.height)),i&&(c.opacity=.1,r.opacity=1),h.fancybox.setTranslate(t.$content.removeClass("fancybox-is-hidden"),c),f(t.$content),void h.fancybox.animate(t.$content,r,o,function(){s.isAnimating=!1,s.complete()})):(s.updateSlide(t),e?(h.fancybox.stop(a),n="fancybox-slide--"+(t.pos>=s.prevPos?"next":"previous")+" fancybox-animated fancybox-fx-"+e,a.addClass(n).removeClass("fancybox-slide--current"),t.$content.removeClass("fancybox-is-hidden"),f(a),"image"!==t.type&&t.$content.hide().show(0),void h.fancybox.animate(a,"fancybox-slide--current",o,function(){a.removeClass(n).css({transform:"",opacity:""}),t.pos===s.currPos&&s.complete()},!0)):(t.$content.removeClass("fancybox-is-hidden"),d||!l||"image"!==t.type||t.hasError||t.$content.hide().fadeIn("fast"),void(t.pos===s.currPos&&s.complete())))},getThumbPos:function(t){var e,n,o,i,s=t.$thumb;return!!(s&&(o=s[0])&&o.ownerDocument===a&&(h(".fancybox-container").css("pointer-events","none"),i={x:o.getBoundingClientRect().left+o.offsetWidth/2,y:o.getBoundingClientRect().top+o.offsetHeight/2},o=a.elementFromPoint(i.x,i.y)===o,h(".fancybox-container").css("pointer-events",""),o))&&(n=h.fancybox.getTranslate(s),t=parseFloat(s.css("border-top-width")||0),i=parseFloat(s.css("border-right-width")||0),o=parseFloat(s.css("border-bottom-width")||0),s=parseFloat(s.css("border-left-width")||0),e={top:n.top+t,left:n.left+s,width:n.width-i-s,height:n.height-t-o,scaleX:1,scaleY:1},0<n.width&&0<n.height&&e)},complete:function(){var t,n=this,e=n.current,o={};!n.isMoved()&&e.isLoaded&&(e.isComplete||(e.isComplete=!0,e.$slide.siblings().trigger("onReset"),n.preload("inline"),f(e.$slide),e.$slide.addClass("fancybox-slide--complete"),h.each(n.slides,function(t,e){e.pos>=n.currPos-1&&e.pos<=n.currPos+1?o[e.pos]=e:e&&(h.fancybox.stop(e.$slide),e.$slide.off().remove())}),n.slides=o),n.isAnimating=!1,n.updateCursor(),n.trigger("afterShow"),e.opts.video.autoStart&&e.$slide.find("video,audio").filter(":visible:first").trigger("play").one("ended",function(){Document.exitFullscreen?Document.exitFullscreen():this.webkitExitFullscreen&&this.webkitExitFullscreen(),n.next()}),e.opts.autoFocus&&"html"===e.contentType&&((t=e.$content.find("input[autofocus]:enabled:visible:first")).length?t.trigger("focus"):n.focus(null,!0)),e.$slide.scrollTop(0).scrollLeft(0))},preload:function(t){var e,n,o=this;o.group.length<2||(n=o.slides[o.currPos+1],(e=o.slides[o.currPos-1])&&e.type===t&&o.loadSlide(e),n&&n.type===t&&o.loadSlide(n))},focus:function(t,e){var n=this,o=["a[href]","area[href]",'input:not([disabled]):not([type="hidden"]):not([aria-hidden])',"select:not([disabled]):not([aria-hidden])","textarea:not([disabled]):not([aria-hidden])","button:not([disabled]):not([aria-hidden])","iframe","object","embed","video","audio","[contenteditable]",'[tabindex]:not([tabindex^="-"])'].join(",");n.isClosing||((e=(e=!t&&n.current&&n.current.isComplete?n.current.$slide.find("*:visible"+(e?":not(.fancybox-close-small)":"")):n.$refs.container.find("*:visible")).filter(o).filter(function(){return"hidden"!==h(this).css("visibility")&&!h(this).hasClass("disabled")})).length?(o=e.index(a.activeElement),t&&t.shiftKey?(o<0||0==o)&&(t.preventDefault(),e.eq(e.length-1).trigger("focus")):(o<0||o==e.length-1)&&(t&&t.preventDefault(),e.eq(0).trigger("focus"))):n.$refs.container.trigger("focus"))},activate:function(){var e=this;h(".fancybox-container").each(function(){var t=h(this).data("FancyBox");t&&t.id!==e.id&&!t.isClosing&&(t.trigger("onDeactivate"),t.removeEvents(),t.isVisible=!1)}),e.isVisible=!0,(e.current||e.isIdle)&&(e.update(),e.updateControls()),e.trigger("onActivate"),e.addEvents()},close:function(t,e){function n(){c.cleanUp(t)}var o,i,s,a,r,c=this,l=c.current;return!c.isClosing&&(!(c.isClosing=!0)===c.trigger("beforeClose",t)?(c.isClosing=!1,d(function(){c.update()}),!1):(c.removeEvents(),s=l.$content,o=l.opts.animationEffect,i=h.isNumeric(e)?e:o?l.opts.animationDuration:0,l.$slide.removeClass("fancybox-slide--complete fancybox-slide--next fancybox-slide--previous fancybox-animated"),!0!==t?h.fancybox.stop(l.$slide):o=!1,l.$slide.siblings().trigger("onReset").remove(),i&&c.$refs.container.removeClass("fancybox-is-open").addClass("fancybox-is-closing").css("transition-duration",i+"ms"),c.hideLoading(l),c.hideControls(!0),c.updateCursor(),"zoom"!==o||s&&i&&"image"===l.type&&!c.isMoved()&&!l.hasError&&(r=c.getThumbPos(l))||(o="fade"),"zoom"===o?(h.fancybox.stop(s),e={top:(a=h.fancybox.getTranslate(s)).top,left:a.left,scaleX:a.width/r.width,scaleY:a.height/r.height,width:r.width,height:r.height},"auto"==(a=l.opts.zoomOpacity)&&(a=.1<Math.abs(l.width/l.height-r.width/r.height)),a&&(r.opacity=0),h.fancybox.setTranslate(s,e),f(s),h.fancybox.animate(s,r,i,n)):o&&i?h.fancybox.animate(l.$slide.addClass("fancybox-slide--previous").removeClass("fancybox-slide--current"),"fancybox-animated fancybox-fx-"+o,i,n):!0===t?setTimeout(n,i):n(),!0))},cleanUp:function(t){var e,n=this,o=n.current.opts.$orig;n.current.$slide.trigger("onReset"),n.$refs.container.empty().remove(),n.trigger("afterClose",t),n.current.opts.backFocus&&(o&&o.length&&o.is(":visible")||(o=n.$trigger),o&&o.length&&(e=c.scrollX,t=c.scrollY,o.trigger("focus"),h("html, body").scrollTop(t).scrollLeft(e))),n.current=null,(n=h.fancybox.getInstance())?n.activate():(h("body").removeClass("fancybox-active compensate-for-scrollbar"),h("#fancybox-style-noscroll").remove())},trigger:function(t,e){var n,o=Array.prototype.slice.call(arguments,1),i=this,e=e&&e.opts?e:i.current;if(e?o.unshift(e):e=i,o.unshift(i),h.isFunction(e.opts[t])&&(n=e.opts[t].apply(e,o)),!1===n)return n;("afterClose"!==t&&i.$refs?i.$refs.container:s).trigger(t+".fb",o)},updateControls:function(){var t=this,e=t.current,n=e.index,o=t.$refs.container,i=t.$refs.caption,s=e.opts.caption;e.$slide.trigger("refresh"),s&&s.length?(t.$caption=i).children().eq(0).html(s):t.$caption=null,t.hasHiddenControls||t.isIdle||t.showControls(),o.find("[data-fancybox-count]").html(t.group.length),o.find("[data-fancybox-index]").html(n+1),o.find("[data-fancybox-prev]").prop("disabled",!e.opts.loop&&n<=0),o.find("[data-fancybox-next]").prop("disabled",!e.opts.loop&&n>=t.group.length-1),"image"===e.type?o.find("[data-fancybox-zoom]").show().end().find("[data-fancybox-download]").attr("href",e.opts.image.src||e.src).show():e.opts.toolbar&&o.find("[data-fancybox-download],[data-fancybox-zoom]").hide(),h(a.activeElement).is(":hidden,[disabled]")&&t.$refs.container.trigger("focus")},hideControls:function(t){var e=["infobar","toolbar","nav"];!t&&this.current.opts.preventCaptionOverlap||e.push("caption"),this.$refs.container.removeClass(e.map(function(t){return"fancybox-show-"+t}).join(" ")),this.hasHiddenControls=!0},showControls:function(){var t=this,e=(t.current||t).opts,n=t.$refs.container;t.hasHiddenControls=!1,t.idleSecondsCounter=0,n.toggleClass("fancybox-show-toolbar",!(!e.toolbar||!e.buttons)).toggleClass("fancybox-show-infobar",!!(e.infobar&&1<t.group.length)).toggleClass("fancybox-show-caption",!!t.$caption).toggleClass("fancybox-show-nav",!!(e.arrows&&1<t.group.length)).toggleClass("fancybox-is-modal",!!e.modal)},toggleControls:function(){this.hasHiddenControls?this.showControls():this.hideControls()}}),h.fancybox={version:"3.5.7",defaults:t,getInstance:function(t){var e=h('.fancybox-container:not(".fancybox-is-closing"):last').data("FancyBox"),n=Array.prototype.slice.call(arguments,1);return e instanceof o&&("string"===h.type(t)?e[t].apply(e,n):"function"===h.type(t)&&t.apply(e,n),e)},open:function(t,e,n){return new o(t,e,n)},close:function(t){var e=this.getInstance();e&&(e.close(),!0===t&&this.close(t))},destroy:function(){this.close(!0),s.add("body").off("click.fb-start","**")},isMobile:/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),use3d:(t=a.createElement("div"),c.getComputedStyle&&c.getComputedStyle(t)&&c.getComputedStyle(t).getPropertyValue("transform")&&!(a.documentMode&&a.documentMode<11)),getTranslate:function(t){var e;return!(!t||!t.length)&&{top:(e=t[0].getBoundingClientRect()).top||0,left:e.left||0,width:e.width,height:e.height,opacity:parseFloat(t.css("opacity"))}},setTranslate:function(t,e){var n="",o={};if(t&&e)return e.left===g&&e.top===g||(n=(e.left===g?t.position():e).left+"px, "+(e.top===g?t.position():e).top+"px",n=this.use3d?"translate3d("+n+", 0px)":"translate("+n+")"),e.scaleX!==g&&e.scaleY!==g?n+=" scale("+e.scaleX+", "+e.scaleY+")":e.scaleX!==g&&(n+=" scaleX("+e.scaleX+")"),n.length&&(o.transform=n),e.opacity!==g&&(o.opacity=e.opacity),e.width!==g&&(o.width=e.width),e.height!==g&&(o.height=e.height),t.css(o)},animate:function(e,n,o,i,s){var a,r=this;h.isFunction(o)&&(i=o,o=null),r.stop(e),a=r.getTranslate(e),e.on(l,function(t){t&&t.originalEvent&&(!e.is(t.originalEvent.target)||"z-index"==t.originalEvent.propertyName)||(r.stop(e),h.isNumeric(o)&&e.css("transition-duration",""),h.isPlainObject(n)?n.scaleX!==g&&n.scaleY!==g&&r.setTranslate(e,{top:n.top,left:n.left,width:a.width*n.scaleX,height:a.height*n.scaleY,scaleX:1,scaleY:1}):!0!==s&&e.removeClass(n),h.isFunction(i)&&i(t))}),h.isNumeric(o)&&e.css("transition-duration",o+"ms"),h.isPlainObject(n)?(n.scaleX!==g&&n.scaleY!==g&&(delete n.width,delete n.height,e.parent().hasClass("fancybox-slide--image")&&e.parent().addClass("fancybox-is-scaling")),h.fancybox.setTranslate(e,n)):e.addClass(n),e.data("timer",setTimeout(function(){e.trigger(l)},o+33))},stop:function(t,e){t&&t.length&&(clearTimeout(t.data("timer")),e&&t.trigger(l),t.off(l).css("transition-duration",""),t.parent().removeClass("fancybox-is-scaling"))}},h.fn.fancybox=function(t){var e;return(e=(t=t||{}).selector||!1)?h("body").off("click.fb-start",e).on("click.fb-start",e,{options:t},m):this.off("click.fb-start").on("click.fb-start",{items:this,options:t},m),this},s.on("click.fb-start","[data-fancybox]",m),s.on("click.fb-start","[data-fancybox-trigger]",function(t){h('[data-fancybox="'+h(this).attr("data-fancybox-trigger")+'"]').eq(h(this).attr("data-fancybox-index")||0).trigger("click.fb-start",{$trigger:h(this)})}),n=".fancybox-button",p="fancybox-focus",b=null,s.on("mousedown mouseup focus blur",n,function(t){switch(t.type){case"mousedown":b=h(this);break;case"mouseup":b=null;break;case"focusin":h(n).removeClass(p),h(this).is(b)||h(this).is("[disabled]")||h(this).addClass(p);break;case"focusout":h(n).removeClass(p)}})))}(window,document,jQuery),function(p){"use strict";function h(n,t,e){if(n)return e=e||"","object"===p.type(e)&&(e=p.param(e,!0)),p.each(t,function(t,e){n=n.replace("$"+t,e||"")}),e.length&&(n+=(0<n.indexOf("?")?"&":"?")+e),n}var o={youtube:{matcher:/(youtube\.com|youtu\.be|youtube\-nocookie\.com)\/(watch\?(.*&)?v=|v\/|u\/|embed\/?)?(videoseries\?list=(.*)|[\w-]{11}|\?listType=(.*)&list=(.*))(.*)/i,params:{autoplay:1,autohide:1,fs:1,rel:0,hd:1,wmode:"transparent",enablejsapi:1,html5:1},paramPlace:8,type:"iframe",url:"https://www.youtube-nocookie.com/embed/$4",thumb:"https://img.youtube.com/vi/$4/hqdefault.jpg"},vimeo:{matcher:/^.+vimeo.com\/(.*\/)?([\d]+)(.*)?/,params:{autoplay:1,hd:1,show_title:1,show_byline:1,show_portrait:0,fullscreen:1},paramPlace:3,type:"iframe",url:"//player.vimeo.com/video/$2"},instagram:{matcher:/(instagr\.am|instagram\.com)\/p\/([a-zA-Z0-9_\-]+)\/?/i,type:"image",url:"//$1/p/$2/media/?size=l"},gmap_place:{matcher:/(maps\.)?google\.([a-z]{2,3}(\.[a-z]{2})?)\/(((maps\/(place\/(.*)\/)?\@(.*),(\d+.?\d+?)z))|(\?ll=))(.*)?/i,type:"iframe",url:function(t){return"//maps.google."+t[2]+"/?ll="+(t[9]?t[9]+"&z="+Math.floor(t[10])+(t[12]?t[12].replace(/^\//,"&"):""):t[12]+"").replace(/\?/,"&")+"&output="+(t[12]&&0<t[12].indexOf("layer=c")?"svembed":"embed")}},gmap_search:{matcher:/(maps\.)?google\.([a-z]{2,3}(\.[a-z]{2})?)\/(maps\/search\/)(.*)/i,type:"iframe",url:function(t){return"//maps.google."+t[2]+"/maps?q="+t[5].replace("query=","q=").replace("api=1","")+"&output=embed"}}};p(document).on("objectNeedsType.fb",function(t,e,i){var s,a,r,c,l,d,u=i.src||"",f=!1,n=p.extend(!0,{},o,i.opts.media);p.each(n,function(t,e){if(a=u.match(e.matcher)){if(f=e.type,d=t,l={},e.paramPlace&&a[e.paramPlace]){"?"==(c=a[e.paramPlace])[0]&&(c=c.substring(1)),c=c.split("&");for(var n=0;n<c.length;++n){var o=c[n].split("=",2);2==o.length&&(l[o[0]]=decodeURIComponent(o[1].replace(/\+/g," ")))}}return r=p.extend(!0,{},e.params,i.opts[t],l),u="function"===p.type(e.url)?e.url.call(this,a,r,i):h(e.url,a,r),s="function"===p.type(e.thumb)?e.thumb.call(this,a,r,i):h(e.thumb,a),"youtube"===t?u=u.replace(/&t=((\d+)m)?(\d+)s/,function(t,e,n,o){return"&start="+((n?60*parseInt(n,10):0)+parseInt(o,10))}):"vimeo"===t&&(u=u.replace("&%23","#")),!1}}),f?(i.opts.thumb||i.opts.$thumb&&i.opts.$thumb.length||(i.opts.thumb=s),"iframe"===f&&(i.opts=p.extend(!0,i.opts,{iframe:{preload:!1,attr:{scrolling:"no"}}})),p.extend(i,{type:f,src:u,origSrc:i.src,contentSource:d,contentType:"image"===f?"image":"gmap_place"==d||"gmap_search"==d?"map":"video"})):u&&(i.type=i.opts.defaultType)});var i={youtube:{src:"https://www.youtube.com/iframe_api",class:"YT",loading:!1,loaded:!1},vimeo:{src:"https://player.vimeo.com/api/player.js",class:"Vimeo",loading:!1,loaded:!1},load:function(t){var e,n=this;this[t].loaded?setTimeout(function(){n.done(t)}):this[t].loading||(this[t].loading=!0,(e=document.createElement("script")).type="text/javascript",e.src=this[t].src,"youtube"===t?window.onYouTubeIframeAPIReady=function(){n[t].loaded=!0,n.done(t)}:e.onload=function(){n[t].loaded=!0,n.done(t)},document.body.appendChild(e))},done:function(t){var e,n;"youtube"===t&&delete window.onYouTubeIframeAPIReady,(e=p.fancybox.getInstance())&&(n=e.current.$content.find("iframe"),"youtube"===t&&void 0!==YT&&YT?new YT.Player(n.attr("id"),{events:{onStateChange:function(t){0==t.data&&e.next()}}}):"vimeo"===t&&void 0!==Vimeo&&Vimeo&&new Vimeo.Player(n).on("ended",function(){e.next()}))}};p(document).on({"afterShow.fb":function(t,e,n){1<e.group.length&&("youtube"===n.contentSource||"vimeo"===n.contentSource)&&i.load(n.contentSource)}})}(jQuery),function(d,c,u){"use strict";function f(t){var e,n=[];for(e in t=(t=t.originalEvent||t||d.e).touches&&t.touches.length?t.touches:t.changedTouches&&t.changedTouches.length?t.changedTouches:[t])t[e].pageX?n.push({x:t[e].pageX,y:t[e].pageY}):t[e].clientX&&n.push({x:t[e].clientX,y:t[e].clientY});return n}function p(t,e,n){return e&&t?"x"===n?t.x-e.x:"y"===n?t.y-e.y:Math.sqrt(Math.pow(t.x-e.x,2)+Math.pow(t.y-e.y,2)):0}function l(t){if(t.is('a,area,button,[role="button"],input,label,select,summary,textarea,video,audio,iframe')||u.isFunction(t.get(0).onclick)||t.data("selectable"))return 1;for(var e=0,n=t[0].attributes,o=n.length;e<o;e++)if("data-fancybox-"===n[e].nodeName.substr(0,14))return 1}function h(t){for(var e,n,o,i=!1;e=t.get(0),n=o=n=void 0,n=d.getComputedStyle(e)["overflow-y"],o=d.getComputedStyle(e)["overflow-x"],n=("scroll"===n||"auto"===n)&&e.scrollHeight>e.clientHeight,e=("scroll"===o||"auto"===o)&&e.scrollWidth>e.clientWidth,!(i=n||e)&&(t=t.parent()).length&&!t.hasClass("fancybox-stage")&&!t.is("body"););return i}function n(t){var e=this;e.instance=t,e.$bg=t.$refs.bg,e.$stage=t.$refs.stage,e.$container=t.$refs.container,e.destroy(),e.$container.on("touchstart.fb.touch mousedown.fb.touch",u.proxy(e,"ontouchstart"))}var g=d.requestAnimationFrame||d.webkitRequestAnimationFrame||d.mozRequestAnimationFrame||d.oRequestAnimationFrame||function(t){return d.setTimeout(t,1e3/60)},b=d.cancelAnimationFrame||d.webkitCancelAnimationFrame||d.mozCancelAnimationFrame||d.oCancelAnimationFrame||function(t){d.clearTimeout(t)};n.prototype.destroy=function(){var t=this;t.$container.off(".fb.touch"),u(c).off(".fb.touch"),t.requestId&&(b(t.requestId),t.requestId=null),t.tapped&&(clearTimeout(t.tapped),t.tapped=null)},n.prototype.ontouchstart=function(t){var e=this,n=u(t.target),o=e.instance,i=o.current,s=i.$slide,a=i.$content,r="touchstart"==t.type;if(r&&e.$container.off("mousedown.fb.touch"),(!t.originalEvent||2!=t.originalEvent.button)&&s.length&&n.length&&!l(n)&&!l(n.parent())&&(n.is("img")||!(t.originalEvent.clientX>n[0].clientWidth+n.offset().left))){if(!i||o.isAnimating||i.$slide.hasClass("fancybox-animated"))return t.stopPropagation(),void t.preventDefault();e.realPoints=e.startPoints=f(t),e.startPoints.length&&(i.touch&&t.stopPropagation(),e.startEvent=t,e.canTap=!0,e.$target=n,e.$content=a,e.opts=i.opts.touch,e.isPanning=!1,e.isSwiping=!1,e.isZooming=!1,e.isScrolling=!1,e.canPan=o.canPan(),e.startTime=(new Date).getTime(),e.distanceX=e.distanceY=e.distance=0,e.canvasWidth=Math.round(s[0].clientWidth),e.canvasHeight=Math.round(s[0].clientHeight),e.contentLastPos=null,e.contentStartPos=u.fancybox.getTranslate(e.$content)||{top:0,left:0},e.sliderStartPos=u.fancybox.getTranslate(s),e.stagePos=u.fancybox.getTranslate(o.$refs.stage),e.sliderStartPos.top-=e.stagePos.top,e.sliderStartPos.left-=e.stagePos.left,e.contentStartPos.top-=e.stagePos.top,e.contentStartPos.left-=e.stagePos.left,u(c).off(".fb.touch").on(r?"touchend.fb.touch touchcancel.fb.touch":"mouseup.fb.touch mouseleave.fb.touch",u.proxy(e,"ontouchend")).on(r?"touchmove.fb.touch":"mousemove.fb.touch",u.proxy(e,"ontouchmove")),u.fancybox.isMobile&&c.addEventListener("scroll",e.onscroll,!0),((e.opts||e.canPan)&&(n.is(e.$stage)||e.$stage.find(n).length)||(n.is(".fancybox-image")&&t.preventDefault(),u.fancybox.isMobile&&n.parents(".fancybox-caption").length))&&(e.isScrollable=h(n)||h(n.parent()),u.fancybox.isMobile&&e.isScrollable||t.preventDefault(),1!==e.startPoints.length&&!i.hasError||(e.canPan?(u.fancybox.stop(e.$content),e.isPanning=!0):e.isSwiping=!0,e.$container.addClass("fancybox-is-grabbing")),2===e.startPoints.length&&"image"===i.type&&(i.isLoaded||i.$ghost)&&(e.canTap=!1,e.isSwiping=!1,e.isPanning=!1,e.isZooming=!0,u.fancybox.stop(e.$content),e.centerPointStartX=.5*(e.startPoints[0].x+e.startPoints[1].x)-u(d).scrollLeft(),e.centerPointStartY=.5*(e.startPoints[0].y+e.startPoints[1].y)-u(d).scrollTop(),e.percentageOfImageAtPinchPointX=(e.centerPointStartX-e.contentStartPos.left)/e.contentStartPos.width,e.percentageOfImageAtPinchPointY=(e.centerPointStartY-e.contentStartPos.top)/e.contentStartPos.height,e.startDistanceBetweenFingers=p(e.startPoints[0],e.startPoints[1]))))}},n.prototype.onscroll=function(t){this.isScrolling=!0,c.removeEventListener("scroll",this.onscroll,!0)},n.prototype.ontouchmove=function(t){var e=this;void 0===t.originalEvent.buttons||0!==t.originalEvent.buttons?e.isScrolling?e.canTap=!1:(e.newPoints=f(t),(e.opts||e.canPan)&&e.newPoints.length&&e.newPoints.length&&(e.isSwiping&&!0===e.isSwiping||t.preventDefault(),e.distanceX=p(e.newPoints[0],e.startPoints[0],"x"),e.distanceY=p(e.newPoints[0],e.startPoints[0],"y"),e.distance=p(e.newPoints[0],e.startPoints[0]),0<e.distance&&(e.isSwiping?e.onSwipe(t):e.isPanning?e.onPan():e.isZooming&&e.onZoom()))):e.ontouchend(t)},n.prototype.onSwipe=function(t){var i=this,s=i.instance,e=i.isSwiping,n=i.sliderStartPos.left||0;if(!0!==e)"x"==e&&(0<i.distanceX&&(i.instance.group.length<2||0===i.instance.current.index&&!i.instance.current.opts.loop)?n+=Math.pow(i.distanceX,.8):i.distanceX<0&&(i.instance.group.length<2||i.instance.current.index===i.instance.group.length-1&&!i.instance.current.opts.loop)?n-=Math.pow(-i.distanceX,.8):n+=i.distanceX),i.sliderLastPos={top:"x"==e?0:i.sliderStartPos.top+i.distanceY,left:n},i.requestId&&(b(i.requestId),i.requestId=null),i.requestId=g(function(){i.sliderLastPos&&(u.each(i.instance.slides,function(t,e){var n=e.pos-i.instance.currPos;u.fancybox.setTranslate(e.$slide,{top:i.sliderLastPos.top,left:i.sliderLastPos.left+n*i.canvasWidth+n*e.opts.gutter})}),i.$container.addClass("fancybox-is-sliding"))});else if(10<Math.abs(i.distance)){if(i.canTap=!1,s.group.length<2&&i.opts.vertical?i.isSwiping="y":s.isDragging||!1===i.opts.vertical||"auto"===i.opts.vertical&&800<u(d).width()?i.isSwiping="x":(n=Math.abs(180*Math.atan2(i.distanceY,i.distanceX)/Math.PI),i.isSwiping=45<n&&n<135?"y":"x"),"y"===i.isSwiping&&u.fancybox.isMobile&&i.isScrollable)return void(i.isScrolling=!0);s.isDragging=i.isSwiping,i.startPoints=i.newPoints,u.each(s.slides,function(t,e){var n,o;u.fancybox.stop(e.$slide),n=u.fancybox.getTranslate(e.$slide),o=u.fancybox.getTranslate(s.$refs.stage),e.$slide.css({transform:"",opacity:"","transition-duration":""}).removeClass("fancybox-animated").removeClass(function(t,e){return(e.match(/(^|\s)fancybox-fx-\S+/g)||[]).join(" ")}),e.pos===s.current.pos&&(i.sliderStartPos.top=n.top-o.top,i.sliderStartPos.left=n.left-o.left),u.fancybox.setTranslate(e.$slide,{top:n.top-o.top,left:n.left-o.left})}),s.SlideShow&&s.SlideShow.isActive&&s.SlideShow.stop()}},n.prototype.onPan=function(){var t=this;p(t.newPoints[0],t.realPoints[0])<(u.fancybox.isMobile?10:5)?t.startPoints=t.newPoints:(t.canTap=!1,t.contentLastPos=t.limitMovement(),t.requestId&&b(t.requestId),t.requestId=g(function(){u.fancybox.setTranslate(t.$content,t.contentLastPos)}))},n.prototype.limitMovement=function(){var t=this,e=t.canvasWidth,n=t.canvasHeight,o=t.distanceX,i=t.distanceY,s=t.contentStartPos,a=s.left,r=s.top,c=s.width,l=s.height,d=e<c?a+o:a,u=r+i,t=Math.max(0,.5*e-.5*c),s=Math.max(0,.5*n-.5*l),c=Math.min(e-c,.5*e-.5*c),l=Math.min(n-l,.5*n-.5*l);return 0<o&&t<d&&(d=t-1+Math.pow(-t+a+o,.8)||0),o<0&&d<c&&(d=c+1-Math.pow(c-a-o,.8)||0),0<i&&s<u&&(u=s-1+Math.pow(-s+r+i,.8)||0),i<0&&u<l&&(u=l+1-Math.pow(l-r-i,.8)||0),{top:u,left:d}},n.prototype.limitPosition=function(t,e,n,o){var i=this.canvasWidth,s=this.canvasHeight;return t=i<n?(t=0<t?0:t)<i-n?i-n:t:Math.max(0,i/2-n/2),{top:e=s<o?(e=0<e?0:e)<s-o?s-o:e:Math.max(0,s/2-o/2),left:t}},n.prototype.onZoom=function(){var t=this,e=t.contentStartPos,n=e.width,o=e.height,i=e.left,s=e.top,a=p(t.newPoints[0],t.newPoints[1])/t.startDistanceBetweenFingers,r=Math.floor(n*a),c=Math.floor(o*a),l=(n-r)*t.percentageOfImageAtPinchPointX,e=(o-c)*t.percentageOfImageAtPinchPointY,n=(t.newPoints[0].x+t.newPoints[1].x)/2-u(d).scrollLeft(),o=(t.newPoints[0].y+t.newPoints[1].y)/2-u(d).scrollTop(),n=n-t.centerPointStartX,a={top:s+(e+(o-t.centerPointStartY)),left:i+(l+n),scaleX:a,scaleY:a};t.canTap=!1,t.newWidth=r,t.newHeight=c,t.contentLastPos=a,t.requestId&&b(t.requestId),t.requestId=g(function(){u.fancybox.setTranslate(t.$content,t.contentLastPos)})},n.prototype.ontouchend=function(t){var e=this,n=e.isSwiping,o=e.isPanning,i=e.isZooming,s=e.isScrolling;if(e.endPoints=f(t),e.dMs=Math.max((new Date).getTime()-e.startTime,1),e.$container.removeClass("fancybox-is-grabbing"),u(c).off(".fb.touch"),c.removeEventListener("scroll",e.onscroll,!0),e.requestId&&(b(e.requestId),e.requestId=null),e.isSwiping=!1,e.isPanning=!1,e.isZooming=!1,e.isScrolling=!1,e.instance.isDragging=!1,e.canTap)return e.onTap(t);e.speed=100,e.velocityX=e.distanceX/e.dMs*.5,e.velocityY=e.distanceY/e.dMs*.5,o?e.endPanning():i?e.endZooming():e.endSwiping(n,s)},n.prototype.endSwiping=function(t,e){var n=this,o=!1,i=n.instance.group.length,s=Math.abs(n.distanceX),s="x"==t&&1<i&&(130<n.dMs&&10<s||50<s);n.sliderLastPos=null,"y"==t&&!e&&50<Math.abs(n.distanceY)?(u.fancybox.animate(n.instance.current.$slide,{top:n.sliderStartPos.top+n.distanceY+150*n.velocityY,opacity:0},200),o=n.instance.close(!0,250)):s&&0<n.distanceX?o=n.instance.previous(300):s&&n.distanceX<0&&(o=n.instance.next(300)),!1!==o||"x"!=t&&"y"!=t||n.instance.centerSlide(200),n.$container.removeClass("fancybox-is-sliding")},n.prototype.endPanning=function(){var t,e,n=this;n.contentLastPos&&(e=!1===n.opts.momentum||350<n.dMs?(t=n.contentLastPos.left,n.contentLastPos.top):(t=n.contentLastPos.left+500*n.velocityX,n.contentLastPos.top+500*n.velocityY),(e=n.limitPosition(t,e,n.contentStartPos.width,n.contentStartPos.height)).width=n.contentStartPos.width,e.height=n.contentStartPos.height,u.fancybox.animate(n.$content,e,366))},n.prototype.endZooming=function(){var t,e,n,o=this,i=o.instance.current,s=o.newWidth,a=o.newHeight;o.contentLastPos&&(t=o.contentLastPos.left,n={top:e=o.contentLastPos.top,left:t,width:s,height:a,scaleX:1,scaleY:1},u.fancybox.setTranslate(o.$content,n),s<o.canvasWidth&&a<o.canvasHeight?o.instance.scaleToFit(150):s>i.width||a>i.height?o.instance.scaleToActual(o.centerPointStartX,o.centerPointStartY,150):(a=o.limitPosition(t,e,s,a),u.fancybox.animate(o.$content,a,150)))},n.prototype.onTap=function(e){function t(t){if(t=a.opts[t],u.isFunction(t)&&(t=t.apply(s,[a,e])),t)switch(t){case"close":s.close(o.startEvent);break;case"toggleControls":s.toggleControls();break;case"next":s.next();break;case"nextOrClose":1<s.group.length?s.next():s.close(o.startEvent);break;case"zoom":"image"==a.type&&(a.isLoaded||a.$ghost)&&(s.canPan()?s.scaleToFit():s.isScaledDown()?s.scaleToActual(c,l):s.group.length<2&&s.close(o.startEvent))}}var n,o=this,i=u(e.target),s=o.instance,a=s.current,r=e&&f(e)||o.startPoints,c=r[0]?r[0].x-u(d).scrollLeft()-o.stagePos.left:0,l=r[0]?r[0].y-u(d).scrollTop()-o.stagePos.top:0;if((!e.originalEvent||2!=e.originalEvent.button)&&(i.is("img")||!(c>i[0].clientWidth+i.offset().left))){if(i.is(".fancybox-bg,.fancybox-inner,.fancybox-outer,.fancybox-container"))n="Outside";else if(i.is(".fancybox-slide"))n="Slide";else{if(!s.current.$content||!s.current.$content.find(i).addBack().filter(i).length)return;n="Content"}if(o.tapped){if(clearTimeout(o.tapped),o.tapped=null,50<Math.abs(c-o.tapX)||50<Math.abs(l-o.tapY))return this;t("dblclick"+n)}else o.tapX=c,o.tapY=l,a.opts["dblclick"+n]&&a.opts["dblclick"+n]!==a.opts["click"+n]?o.tapped=setTimeout(function(){o.tapped=null,s.isAnimating||t("click"+n)},500):t("click"+n);return this}},u(c).on("onActivate.fb",function(t,e){e&&!e.Guestures&&(e.Guestures=new n(e))}).on("beforeClose.fb",function(t,e){e&&e.Guestures&&e.Guestures.destroy()})}(window,document,jQuery),function(s,a){"use strict";function n(t){this.instance=t,this.init()}a.extend(!0,a.fancybox.defaults,{btnTpl:{slideShow:'<button data-fancybox-play class="fancybox-button fancybox-button--play" title="{{PLAY_START}}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6.5 5.4v13.2l11-6.6z"/></svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8.33 5.75h2.2v12.5h-2.2V5.75zm5.15 0h2.2v12.5h-2.2V5.75z"/></svg></button>'},slideShow:{autoStart:!1,speed:3e3,progress:!0}}),a.extend(n.prototype,{timer:null,isActive:!1,$button:null,init:function(){var t=this,e=t.instance,n=e.group[e.currIndex].opts.slideShow;t.$button=e.$refs.toolbar.find("[data-fancybox-play]").on("click",function(){t.toggle()}),e.group.length<2||!n?t.$button.hide():n.progress&&(t.$progress=a('<div class="fancybox-progress"></div>').appendTo(e.$refs.inner))},set:function(t){var e=this,n=e.instance,o=n.current;o&&(!0===t||o.opts.loop||n.currIndex<n.group.length-1)?e.isActive&&"video"!==o.contentType&&(e.$progress&&a.fancybox.animate(e.$progress.show(),{scaleX:1},o.opts.slideShow.speed),e.timer=setTimeout(function(){n.current.opts.loop||n.current.index!=n.group.length-1?n.next():n.jumpTo(0)},o.opts.slideShow.speed)):(e.stop(),n.idleSecondsCounter=0,n.showControls())},clear:function(){clearTimeout(this.timer),this.timer=null,this.$progress&&this.$progress.removeAttr("style").hide()},start:function(){var t=this,e=t.instance.current;e&&(t.$button.attr("title",(e.opts.i18n[e.opts.lang]||e.opts.i18n.en).PLAY_STOP).removeClass("fancybox-button--play").addClass("fancybox-button--pause"),t.isActive=!0,e.isComplete&&t.set(!0),t.instance.trigger("onSlideShowChange",!0))},stop:function(){var t=this,e=t.instance.current;t.clear(),t.$button.attr("title",(e.opts.i18n[e.opts.lang]||e.opts.i18n.en).PLAY_START).removeClass("fancybox-button--pause").addClass("fancybox-button--play"),t.isActive=!1,t.instance.trigger("onSlideShowChange",!1),t.$progress&&t.$progress.removeAttr("style").hide()},toggle:function(){this.isActive?this.stop():this.start()}}),a(s).on({"onInit.fb":function(t,e){e&&!e.SlideShow&&(e.SlideShow=new n(e))},"beforeShow.fb":function(t,e,n,o){e=e&&e.SlideShow;o?e&&n.opts.slideShow.autoStart&&e.start():e&&e.isActive&&e.clear()},"afterShow.fb":function(t,e,n){e=e&&e.SlideShow;e&&e.isActive&&e.set()},"afterKeydown.fb":function(t,e,n,o,i){e=e&&e.SlideShow;!e||!n.opts.slideShow||80!==i&&32!==i||a(s.activeElement).is("button,a,input")||(o.preventDefault(),e.toggle())},"beforeClose.fb onDeactivate.fb":function(t,e){e=e&&e.SlideShow;e&&e.stop()}}),a(s).on("visibilitychange",function(){var t;"3.5.7"!=a.fancybox.version||(t=(t=a.fancybox.getInstance())&&t.SlideShow)&&t.isActive&&(s.hidden?t.clear():t.set())})}(document,jQuery),function(s,n){"use strict";var o,i=function(){for(var t=[["requestFullscreen","exitFullscreen","fullscreenElement","fullscreenEnabled","fullscreenchange","fullscreenerror"],["webkitRequestFullscreen","webkitExitFullscreen","webkitFullscreenElement","webkitFullscreenEnabled","webkitfullscreenchange","webkitfullscreenerror"],["webkitRequestFullScreen","webkitCancelFullScreen","webkitCurrentFullScreenElement","webkitCancelFullScreen","webkitfullscreenchange","webkitfullscreenerror"],["mozRequestFullScreen","mozCancelFullScreen","mozFullScreenElement","mozFullScreenEnabled","mozfullscreenchange","mozfullscreenerror"],["msRequestFullscreen","msExitFullscreen","msFullscreenElement","msFullscreenEnabled","MSFullscreenChange","MSFullscreenError"]],e={},n=0;n<t.length;n++){var o=t[n];if(o&&o[1]in s){for(var i=0;i<o.length;i++)e[t[0][i]]=o[i];return e}}return!1}();i&&(o={request:function(t){(t=t||s.documentElement)[i.requestFullscreen](t.ALLOW_KEYBOARD_INPUT)},exit:function(){s[i.exitFullscreen]()},toggle:function(t){t=t||s.documentElement,this.isFullscreen()?this.exit():this.request(t)},isFullscreen:function(){return Boolean(s[i.fullscreenElement])},enabled:function(){return Boolean(s[i.fullscreenEnabled])}},n.extend(!0,n.fancybox.defaults,{btnTpl:{fullScreen:'<button data-fancybox-fullscreen class="fancybox-button fancybox-button--fsenter" title="{{FULL_SCREEN}}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M5 16h3v3h2v-5H5zm3-8H5v2h5V5H8zm6 11h2v-3h3v-2h-5zm2-11V5h-2v5h5V8z"/></svg></button>'},fullScreen:{autoStart:!1}}),n(s).on(i.fullscreenchange,function(){var t=o.isFullscreen(),e=n.fancybox.getInstance();e&&(e.current&&"image"===e.current.type&&e.isAnimating&&(e.isAnimating=!1,e.update(!0,!0,0),e.isComplete||e.complete()),e.trigger("onFullscreenChange",t),e.$refs.container.toggleClass("fancybox-is-fullscreen",t),e.$refs.toolbar.find("[data-fancybox-fullscreen]").toggleClass("fancybox-button--fsenter",!t).toggleClass("fancybox-button--fsexit",t))})),n(s).on({"onInit.fb":function(t,e){i?e&&e.group[e.currIndex].opts.fullScreen?(e.$refs.container.on("click.fb-fullscreen","[data-fancybox-fullscreen]",function(t){t.stopPropagation(),t.preventDefault(),o.toggle()}),e.opts.fullScreen&&!0===e.opts.fullScreen.autoStart&&o.request(),e.FullScreen=o):e&&e.$refs.toolbar.find("[data-fancybox-fullscreen]").hide():e.$refs.toolbar.find("[data-fancybox-fullscreen]").remove()},"afterKeydown.fb":function(t,e,n,o,i){e&&e.FullScreen&&70===i&&(o.preventDefault(),e.FullScreen.toggle())},"beforeClose.fb":function(t,e){e&&e.FullScreen&&e.$refs.container.hasClass("fancybox-is-fullscreen")&&o.exit()}})}(document,jQuery),function(t,s){"use strict";var a="fancybox-thumbs",r=a+"-active";function o(t){this.init(t)}s.fancybox.defaults=s.extend(!0,{btnTpl:{thumbs:'<button data-fancybox-thumbs class="fancybox-button fancybox-button--thumbs" title="{{THUMBS}}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M14.59 14.59h3.76v3.76h-3.76v-3.76zm-4.47 0h3.76v3.76h-3.76v-3.76zm-4.47 0h3.76v3.76H5.65v-3.76zm8.94-4.47h3.76v3.76h-3.76v-3.76zm-4.47 0h3.76v3.76h-3.76v-3.76zm-4.47 0h3.76v3.76H5.65v-3.76zm8.94-4.47h3.76v3.76h-3.76V5.65zm-4.47 0h3.76v3.76h-3.76V5.65zm-4.47 0h3.76v3.76H5.65V5.65z"/></svg></button>'},thumbs:{autoStart:!1,hideOnClose:!0,parentEl:".fancybox-container",axis:"y"}},s.fancybox.defaults),s.extend(o.prototype,{$button:null,$grid:null,$list:null,isVisible:!1,isActive:!1,init:function(t){var e=this,n=t.group,o=0;e.instance=t,e.opts=n[t.currIndex].opts.thumbs,(t.Thumbs=e).$button=t.$refs.toolbar.find("[data-fancybox-thumbs]");for(var i=0,s=n.length;i<s&&(n[i].thumb&&o++,!(1<o));i++);1<o&&e.opts?(e.$button.removeAttr("style").on("click",function(){e.toggle()}),e.isActive=!0):e.$button.hide()},create:function(){var n,t=this,e=t.instance,o=t.opts.parentEl,i=[];t.$grid||(t.$grid=s('<div class="'+a+" "+a+"-"+t.opts.axis+'"></div>').appendTo(e.$refs.container.find(o).addBack().filter(o)),t.$grid.on("click","a",function(){e.jumpTo(s(this).attr("data-index"))})),t.$list||(t.$list=s('<div class="'+a+'__list">').appendTo(t.$grid)),s.each(e.group,function(t,e){(n=e.thumb)||"image"!==e.type||(n=e.src),i.push('<a href="javascript:;" tabindex="0" data-index="'+t+'"'+(n&&n.length?' style="background-image:url('+n+')"':'class="fancybox-thumbs-missing"')+"></a>")}),t.$list[0].innerHTML=i.join(""),"x"===t.opts.axis&&t.$list.width(parseInt(t.$grid.css("padding-right"),10)+e.group.length*t.$list.children().eq(0).outerWidth(!0))},focus:function(t){var e,n,o=this,i=o.$list,s=o.$grid;o.instance.current&&(n=(e=i.children().removeClass(r).filter('[data-index="'+o.instance.current.index+'"]').addClass(r)).position(),"y"===o.opts.axis&&(n.top<0||n.top>i.height()-e.outerHeight())?i.stop().animate({scrollTop:i.scrollTop()+n.top},t):"x"===o.opts.axis&&(n.left<s.scrollLeft()||n.left>s.scrollLeft()+(s.width()-e.outerWidth()))&&i.parent().stop().animate({scrollLeft:n.left},t))},update:function(){var t=this;t.instance.$refs.container.toggleClass("fancybox-show-thumbs",this.isVisible),t.isVisible?(t.$grid||t.create(),t.instance.trigger("onThumbsShow"),t.focus(0)):t.$grid&&t.instance.trigger("onThumbsHide"),t.instance.update()},hide:function(){this.isVisible=!1,this.update()},show:function(){this.isVisible=!0,this.update()},toggle:function(){this.isVisible=!this.isVisible,this.update()}}),s(t).on({"onInit.fb":function(t,e){var n;e&&!e.Thumbs&&(n=new o(e)).isActive&&!0===n.opts.autoStart&&n.show()},"beforeShow.fb":function(t,e,n,o){e=e&&e.Thumbs;e&&e.isVisible&&e.focus(o?0:250)},"afterKeydown.fb":function(t,e,n,o,i){e=e&&e.Thumbs;e&&e.isActive&&71===i&&(o.preventDefault(),e.toggle())},"beforeClose.fb":function(t,e){e=e&&e.Thumbs;e&&e.isVisible&&!1!==e.opts.hideOnClose&&e.$grid.hide()}})}(document,jQuery),function(t,i){"use strict";i.extend(!0,i.fancybox.defaults,{btnTpl:{share:'<button data-fancybox-share class="fancybox-button fancybox-button--share" title="{{SHARE}}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.55 19c1.4-8.4 9.1-9.8 11.9-9.8V5l7 7-7 6.3v-3.5c-2.8 0-10.5 2.1-11.9 4.2z"/></svg></button>'},share:{url:function(t,e){return!t.currentHash&&"inline"!==e.type&&"html"!==e.type&&(e.origSrc||e.src)||window.location},tpl:'<div class="fancybox-share"><h1>{{SHARE}}</h1><p><a class="fancybox-share__button fancybox-share__button--fb" href="https://www.facebook.com/sharer/sharer.php?u={{url}}"><svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="m287 456v-299c0-21 6-35 35-35h38v-63c-7-1-29-3-55-3-54 0-91 33-91 94v306m143-254h-205v72h196" /></svg><span>Facebook</span></a><a class="fancybox-share__button fancybox-share__button--tw" href="https://twitter.com/intent/tweet?url={{url}}&text={{descr}}"><svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="m456 133c-14 7-31 11-47 13 17-10 30-27 37-46-15 10-34 16-52 20-61-62-157-7-141 75-68-3-129-35-169-85-22 37-11 86 26 109-13 0-26-4-37-9 0 39 28 72 65 80-12 3-25 4-37 2 10 33 41 57 77 57-42 30-77 38-122 34 170 111 378-32 359-208 16-11 30-25 41-42z" /></svg><span>Twitter</span></a><a class="fancybox-share__button fancybox-share__button--pt" href="https://www.pinterest.com/pin/create/button/?url={{url}}&description={{descr}}&media={{media}}"><svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"><path d="m265 56c-109 0-164 78-164 144 0 39 15 74 47 87 5 2 10 0 12-5l4-19c2-6 1-8-3-13-9-11-15-25-15-45 0-58 43-110 113-110 62 0 96 38 96 88 0 67-30 122-73 122-24 0-42-19-36-44 6-29 20-60 20-81 0-19-10-35-31-35-25 0-44 26-44 60 0 21 7 36 7 36l-30 125c-8 37-1 83 0 87 0 3 4 4 5 2 2-3 32-39 42-75l16-64c8 16 31 29 56 29 74 0 124-67 124-157 0-69-58-132-146-132z" fill="#fff"/></svg><span>Pinterest</span></a></p><p><input class="fancybox-share__input" type="text" value="{{url_raw}}" onclick="select()" /></p></div>'}}),i(t).on("click","[data-fancybox-share]",function(){var t,e,n=i.fancybox.getInstance(),o=n.current||null;o&&("function"===i.type(o.opts.share.url)&&(t=o.opts.share.url.apply(o,[n,o])),t=o.opts.share.tpl.replace(/\{\{media\}\}/g,"image"===o.type?encodeURIComponent(o.src):"").replace(/\{\{url\}\}/g,encodeURIComponent(t)).replace(/\{\{url_raw\}\}/g,(e={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;","`":"&#x60;","=":"&#x3D;"},String(t).replace(/[&<>"'`=\/]/g,function(t){return e[t]}))).replace(/\{\{descr\}\}/g,n.$caption?encodeURIComponent(n.$caption.text()):""),i.fancybox.open({src:n.translate(n,t),type:"html",opts:{touch:!1,animationEffect:!1,afterLoad:function(t,e){n.$refs.container.one("beforeClose.fb",function(){t.close(null,0)}),e.$content.find(".fancybox-share__button").on("click",function(){return window.open(this.href,"Share","width=550, height=450"),!1})},mobile:{autoFocus:!1}}}))})}(document,jQuery),function(s,a,o){"use strict";function i(){var t=s.location.hash.substr(1),e=t.split("-"),n=1<e.length&&/^\+?\d+$/.test(e[e.length-1])&&parseInt(e.pop(-1),10)||1;return{hash:t,index:n<1?1:n,gallery:e.join("-")}}function e(t){""!==t.gallery&&o("[data-fancybox='"+o.escapeSelector(t.gallery)+"']").eq(t.index-1).focus().trigger("click.fb-start")}function r(t){return!!t&&(""!==(t=(t=(t.current||t).opts).hash||(t.$orig?t.$orig.data("fancybox")||t.$orig.data("fancybox-trigger"):""))&&t)}o.escapeSelector||(o.escapeSelector=function(t){return(t+"").replace(/([\0-\x1f\x7f]|^-?\d)|^-$|[^\x80-\uFFFF\w-]/g,function(t,e){return e?"\0"===t?"�":t.slice(0,-1)+"\\"+t.charCodeAt(t.length-1).toString(16)+" ":"\\"+t})}),o(function(){"3.5.7"==o.fancybox.version&&!1!==o.fancybox.defaults.hash&&(o(a).on({"onInit.fb":function(t,e){var n,o;!1!==e.group[e.currIndex].opts.hash&&(n=i(),(o=r(e))&&n.gallery&&o==n.gallery&&(e.currIndex=n.index-1))},"beforeShow.fb":function(t,e,n,o){var i;n&&!1!==n.opts.hash&&(i=r(e))&&(e.currentHash=i+(1<e.group.length?"-"+(n.index+1):""),s.location.hash!=="#"+e.currentHash&&(o&&!e.origHash&&(e.origHash=s.location.hash),e.hashTimer&&clearTimeout(e.hashTimer),e.hashTimer=setTimeout(function(){"replaceState"in s.history?(s.history[o?"pushState":"replaceState"]({},a.title,s.location.pathname+s.location.search+"#"+e.currentHash),o&&(e.hasCreatedHistory=!0)):s.location.hash=e.currentHash,e.hashTimer=null},300)))},"beforeClose.fb":function(t,e,n){n&&!1!==n.opts.hash&&(clearTimeout(e.hashTimer),e.currentHash&&e.hasCreatedHistory?s.history.back():e.currentHash&&("replaceState"in s.history?s.history.replaceState({},a.title,s.location.pathname+s.location.search+(e.origHash||"")):s.location.hash=e.origHash),e.currentHash=null)}}),o(s).on("hashchange.fb",function(){var t=i(),n=null;o.each(o(".fancybox-container").get().reverse(),function(t,e){e=o(e).data("FancyBox");if(e&&e.currentHash)return n=e,!1}),n?n.currentHash===t.gallery+"-"+t.index||1===t.index&&n.currentHash==t.gallery||(n.currentHash=null,n.close()):""!==t.gallery&&e(t)}),setTimeout(function(){"3.5.7"==o.fancybox.version&&(o.fancybox.getInstance()||e(i()))},50))})}(window,document,jQuery),function(t,e){"use strict";var i=(new Date).getTime();e(t).on({"onInit.fb":function(t,o,e){o.$refs.stage.on("mousewheel DOMMouseScroll wheel MozMousePixelScroll",function(t){var e=o.current,n=(new Date).getTime();o.group.length<2||!1===e.opts.wheel||"auto"===e.opts.wheel&&"image"!==e.type||(t.preventDefault(),t.stopPropagation(),e.$slide.hasClass("fancybox-animated")||(t=t.originalEvent||t,n-i<250||(i=n,o[(-t.deltaY||-t.deltaX||t.wheelDelta||-t.detail)<0?"next":"previous"]())))})}})}(document,jQuery);

/* jQuery fancybox lightbox */
/* -------------------------------------------------------------------- */
function mk_lightbox_init() {

  $(".mk-lightbox").fancybox({
    loop: true,
  });

  $.fancybox.defaults.hash = false;

}


(function($, window){
    'use strict';

    var scrollY = MK.val.scroll; 
    var dynamicHeight = MK.val.dynamicHeight;

    var $window = $(window);
    var $containers = $('.js-loop');

    $containers.each( pagination );

	$window.on( 'vc_reload', function() {
		$('.js-loop').each( pagination );
	} );

    function pagination() {
        var unique = Date.now();
        var $container = $(this);
        var $superContainer = $container.parent(); // should contain clearing so it stretches with floating children
        var $loadBtn = $container.siblings('.js-loadmore-holder').find('.js-loadmore-button');
        var $loadScroll = $('.js-load-more-scroll');
        var style = $container.data('pagination-style');
        var maxPages = $container.data('max-pages');
        var id = '#' + ($container.attr('id'));
        var ajaxLoader = new MK.utils.ajaxLoader(id);
        var isLoadBtn = (style === 2);
        var isInfiniteScroll = (style === 3); // add flag for last container
        var scrollCheckPoint = null;
        var isHandlerBinded = false;

        ajaxLoader.init();

        init();

        function init() {
            MK.utils.eventManager.subscribe('ajaxLoaded', onLoad);
            bindHandlers();
            if( isInfiniteScroll ) scrollCheckPoint = spyScrollCheckPoint();

			$window.on( 'vc_reload', function() {
				$window.off('scroll', handleScroll);
			} );
        }

        function bindHandlers() {
            if( isLoadBtn ) $loadBtn.on('click', handleClick);
            if( isInfiniteScroll ) $window.on('scroll', handleScroll); 
            isHandlerBinded = true;
        }

        function unbindHandlers() {
            if( isLoadBtn ) $loadBtn.off('click', handleClick);
            if( isInfiniteScroll ) $window.off('scroll', handleScroll);
            isHandlerBinded = false;
        }

        function handleClick(e) {
            e.preventDefault();
            if(!ajaxLoader.isLoading) loadMore();
        }

        function handleScroll() {
            if((scrollY() > scrollCheckPoint()) && !ajaxLoader.isLoading) loadMore();
        }

        function loadMore() {
            loadingIndicatorStart();
            var page = ajaxLoader.getData('paged');
            ajaxLoader.setData({paged: ++page});
            ajaxLoader.load(unique);
        }

        function onLoad(e, response) {
            if( typeof response !== 'undefined' && response.id === id) {
                // Checking found posts helps to fix all pagination styles 
                if( ajaxLoader.getData('found_posts') <= 0 && ajaxLoader.getData('paged') >= ajaxLoader.getData('maxPages')) loadingIndicatorHide();
                else loadingIndicatorShow();
                if(response.unique === unique) $container.append(response.content);
                loadingIndicatorStop();
            }
        }

        function loadingIndicatorStart() {
            if(isLoadBtn) $loadBtn.addClass('is-active');
            else if(isInfiniteScroll) MK.ui.loader.add('.js-load-more-scroll');

        }

        function loadingIndicatorStop() {
            if(isLoadBtn) $loadBtn.removeClass('is-active');
            else if(isInfiniteScroll) MK.ui.loader.remove('.js-load-more-scroll');
        }

        function loadingIndicatorShow() {
            if(isHandlerBinded) return;
            if(isLoadBtn) $loadBtn.show();
            else if(isInfiniteScroll) $loadScroll.show();
            bindHandlers();
        }

        function loadingIndicatorHide() {
            if(!isHandlerBinded) return;
            if(isLoadBtn) $loadBtn.hide();
            else if(isInfiniteScroll) $loadScroll.hide();
            unbindHandlers();
        }


        function spyScrollCheckPoint() {
            var containerO = 0;
            var containerH = dynamicHeight( $superContainer );
            var winH = dynamicHeight( window );
 
            var setVals = function() {
                containerO = $superContainer.offset().top;
            };

            setVals();
            $window.on('resize', function() { requestAnimationFrame(setVals); });

            return function() {
                return (containerH() + containerO) - (winH() * 2);
            };
        }
    }

})(jQuery, window);
(function($) {
  'use strict';

  var MK = window.MK || {};
  window.MK = MK;
  MK.component = window.MK.component || {};

	// Check if it's inside hidden parent
	// Cannot be position: fixed
	function isHidden(el) {
	    return (el.offsetParent === null);
	}

	MK.component.Masonry = function(el) {
		var $window = $(window);
		var $container = $(el);
		var config = $container.data( 'masonry-config' );
		var $masonryItems = $container.find(config.item);
		var cols = config.cols || 8;
		var $filterItems = null; // assign only when apply filter
    var wall = null;

        var init = function init() {
          MK.core.loadDependencies([ MK.core.path.plugins + 'freewall.js' ], onDepLoad);
        };

        var onDepLoad = function onDepLoad() {
          masonry();

        	// Events
	        $window.on('resize', onResize);
            MK.utils.eventManager.subscribe('ajaxLoaded', onPostAddition);
			MK.utils.eventManager.subscribe('staticFilter', resize);
        };

	    var masonry = function masonry() {
	    	// Quit for hidden elements for now.
        if(isHidden(el)) return;

	    	var newCols;
	    	if(window.matchMedia( '(max-width:600px)' ).matches) newCols = 2;
	    	else if(window.matchMedia( '(max-width:850px)' ).matches) newCols = 4;
	    	else newCols = cols;

        var colW = $container.width() / newCols;

        wall = new Freewall( config.container );

	        // We need to pass settings to a plugin via reset method. Strange but works fine.
			wall.reset({
				selector: config.item + ':not(.is-hidden)',
				gutterX: 0, // set default gutter to 0 and again - apply margins to item holders in css
				gutterY: 0,
				cellW: colW,
				cellH: colW
			});

	        wall.fillHoles();
          wall.fitWidth();

	        $masonryItems.each(function() {
	        	$(this).data('loaded', true);
	        });
        };


		// Clear attributes after the plugin. It's API method dosn't handle it properly
		var destroyContainer = function destroyContainer() {
			$container.removeAttr('style')
				 .removeData('wall-height')
				 .removeData('wall-width')
				 .removeData('min-width')
				 .removeData('total-col')
				 .removeData('total-row')
				 .removeAttr('data-wall-height')
				 .removeAttr('data-wall-width')
				 .removeAttr('data-min-width')
				 .removeAttr('data-total-col')
				 .removeAttr('data-total-row');
		};

		var destroyItem = function destroyItem() {
			var $item = $(this);
			$item.removeAttr('style')
				 .removeData('delay')
				 .removeData('height')
				 .removeData('width')
				 .removeData('state')
				 .removeAttr('data-delay')
				 .removeAttr('data-height')
				 .removeAttr('data-width')
				 .removeAttr('data-state');
		};

		var destroyAll = function destroyAll() {
	    	if( !wall ) return;
    		wall.destroy(); // API destroy
    		destroyContainer();
    		$masonryItems.each( destroyItem ); // run our deeper destroy
		};

		var onResize = function onResize() {
			requestAnimationFrame(resize);
		};

        var refresh = function refresh() {
	    	if( !wall ) return;
	    	setTimeout(wall.fitWidth.bind(wall), 5);
        };

        var resize = function resize() {
        	destroyAll();
	    	masonry();
        };

        var onPostAddition = function onPostAddition() {
        	$masonryItems = $container.find(config.item);

        	$masonryItems.each(function() {
        		var $item = $(this),
        			isLoaded = $item.data('loaded');

        		if(!isLoaded) $item.css('visibility', 'hidden');
        	});


        	$container.mk_imagesLoaded().then(function() {
        		destroyAll();
        		masonry();
        	});
        };

        return {
         	init : init
        };
	};

}(jQuery));

/* Milestone Number Shortcode */
/* -------------------------------------------------------------------- */

function mk_milestone() {

  "use strict";

  if( !$.exists('.mk-milestone') ) return;

  $('.mk-milestone').each(function () {
    var $this = $(this),
      stop_number = $this.find('.milestone-number').attr('data-stop'),
      animation_speed = parseInt($this.find('.milestone-number').attr('data-speed'));

    var build = function() {
      if (!$this.hasClass('scroll-animated')) {
        $this.addClass('scroll-animated');

        $({
          countNum: $this.find('.milestone-number').text()
        }).animate({
          countNum: stop_number
        }, {
          duration: animation_speed,
          easing: 'linear',
          step: function () {
            $this.find('.milestone-number').text(Math.floor(this.countNum));
          },
          complete: function () {
            $this.find('.milestone-number').text(this.countNum);
          }
        });
      }
    };

    if ( !MK.utils.isMobile() ) {
      // refactored only :in-viewport logic. rest is to-do
      MK.utils.scrollSpy( this, {
          position: 'bottom',
          after: build
      });
    } else {
      build();
    }

  });

}




(function($) {
	'use strict';

	MK.component.Pagination = function(el) {
		this.el = el;
	};

	MK.component.Pagination.prototype = {
		init: function init() {
			this.cacheElements();
			this.bindEvents();
			this.onInitLoad();
		},

		cacheElements: function cacheElements() {
			this.lastId = 1;
			this.unique = Date.now();
			this.$pagination = $(this.el);
			this.$container = this.$pagination.prev('.js-loop');
			this.$pageLinks = this.$pagination.find('.js-pagination-page');
			this.$nextLink = this.$pagination.find('.js-pagination-next');
			this.$prevLink = this.$pagination.find('.js-pagination-prev');
			this.$current = this.$pagination.find('.js-current-page');
			this.$maxPages = this.$pagination.find('.pagination-max-pages'); // TODO change in DOM and here to js class
			this.containerId = '#' + this.$container.attr('id');
			this.pagePathname = window.location.pathname;
			this.pageSearch = window.location.search;
			this.popState = false;
			this.ajaxLoader = new MK.utils.ajaxLoader('#' + this.$container.attr('id'));
			this.ajaxLoader.init();
		},

		bindEvents: function bindEvents() {
			this.$pageLinks.on('click', this.pageClick.bind(this));
			this.$nextLink.on('click', this.nextClick.bind(this));
			this.$prevLink.on('click', this.prevClick.bind(this));
			MK.utils.eventManager.subscribe('ajaxLoaded', this.onLoad.bind(this));
		},

		pageClick: function pageClick(e) {
			e.preventDefault();
			var $this = $(e.currentTarget);
			var id = parseFloat($this.attr('data-page-id'));

			if(id > this.ajaxLoader.getData('maxPages') || id < 1) return;
			this.load(id, $this);
			this.updatePagedNumUrl( id );
		},

		nextClick: function nextClick(e) {
			e.preventDefault();
			if(this.ajaxLoader.getData('paged') === this.ajaxLoader.getData('maxPages')) return;
			this.load(++this.lastId, $(e.currentTarget));
			this.updatePagedNumUrl( this.lastId );
		},

		prevClick: function prevClick(e) {
			e.preventDefault();
			if(this.ajaxLoader.getData('paged') === 1) return;
			this.load(--this.lastId, $(e.currentTarget));
			this.updatePagedNumUrl( this.lastId );
		},

		load: function load(id, $el) {
			this.lastId = id;
			this.ajaxLoader.setData({paged: id});
			this.ajaxLoader.load(this.unique);
			this.removeIndicator();
			MK.ui.loader.add($el);
		},

    onLoad: function success(e, response) {
      if (typeof response !== 'undefined' && response.id === this.containerId) {
        this.updatePagination();
        this.lastId = this.ajaxLoader.getData('paged');

        if (response.unique === this.unique) {
          this.removeIndicator();
          this.scrollPage();
          this.$container.html(response.content);
        }
      }
    },

        updatePagination: function updatePagination() {
        	var self = this;

        	// Hide / show arrows
        	var isFirst = (this.ajaxLoader.getData('paged') === 1);
        	var isLast = (this.ajaxLoader.getData('paged') === this.ajaxLoader.getData('maxPages'));

        	if(isFirst) this.$prevLink.addClass('is-vis-hidden');
        	else this.$prevLink.removeClass('is-vis-hidden');

        	if(isLast) this.$nextLink.addClass('is-vis-hidden');
        	else this.$nextLink.removeClass('is-vis-hidden');

			// X of Y
			this.$current.html(this.ajaxLoader.getData('paged'));
			this.$maxPages.html(this.ajaxLoader.getData('maxPages'));

			// Move overfloating items
			var displayItems = 10;
			var centerAt = displayItems / 2;

			if(this.ajaxLoader.getData('maxPages') > displayItems) {
				this.$pageLinks.each(function(i) {

					var id = self.lastId - centerAt;
						id = Math.max(id, 1);
						id = Math.min(id, self.ajaxLoader.getData('maxPages') - displayItems + 1);
						id = id + i;

					$(this).html( id ).attr('data-page-id', id).show();

					if(i === 0 && id > 1) $(this).html('...');
					if(i === displayItems - 1 && id < self.ajaxLoader.getData('maxPages')) $(this).html('...');
				});
			} else {
				this.$pageLinks.each(function(i) {
					var $link = $(this);
					var id = i + 1;

					$link.html(id).attr('data-page-id', id);

					if( self.ajaxLoader.getData('maxPages') === 1) {
						self.$pageLinks.hide();
					} else {
						if(i > self.ajaxLoader.getData('maxPages') - 1) $link.hide();
						else $link.show();
					}

				});
			}

        	// Highlight current only
			this.$pageLinks.filter('[data-page-id="' + this.ajaxLoader.getData('paged') + '"]' ).addClass('current-page')
				 .siblings().removeClass('current-page');

        },

    scrollPage: function scrollPage() {
      var containerOffset = this.$container.offset().top;
      var offset = containerOffset - MK.val.offsetHeaderHeight( containerOffset ) - 20;

      this.$container.find('a:first').focus()
      MK.utils.scrollTo( offset );
    },

    removeIndicator: function removeIndicator() {
      MK.ui.loader.remove('.js-pagination-page, .js-pagination-next, .js-pagination-prev');
    },

		/**
		 * Set some actions when archive/category page is loaded. Actions list:
		 * - Select the correct paged ID on pagination list.
		 * - Set current paged ID on the label.
		 * - Add event listener onpopstate for handling prev/next button of Browser URL.
		 * - Set info for updatePagedNumUrl() about request comes from popstate.
		 *
		 * @since 5.9.8
		 */
		onInitLoad: function onInitLoad() {
			var initPagedID = this.$pagination.data( 'init-pagination' );
			if ( initPagedID && initPagedID > 1 ) {
				this.$current.html( initPagedID );
				this.$pageLinks.filter( '[data-page-id="' + initPagedID + '"]' ).addClass( 'current-page' ).siblings().removeClass( 'current-page' );
			}

			// Run popstate only if it's supported by the browser.
			if ( 'onpopstate' in window ) {
				var thisPop = this;
				window.onpopstate = function( event ) {
					var id = 1;

					// At start, state is always null. So, we should check it before processing.
					if ( typeof event.state === 'object' && event.state ) {
						var state = event.state;

						// Set paged ID for updating page.
						if ( state.hasOwnProperty( 'MkPagination' ) ) {
							var currentState = state.MkPagination;
							if ( currentState.hasOwnProperty( 'paged' ) ) {
								id = parseFloat( currentState.paged );
							}
						}
					} else {
						id = parseFloat( thisPop.getURLPagedID() );
					}

					// Tell updatePagedNumUrl() if request come from popstate.
					thisPop.popState = true;
					thisPop.$pageLinks.filter( '[data-page-id="' + id + '"]' ).trigger( 'click' );
				}
			}
		},

		/**
		 * Update current pagination browser URL by adding/changing paged number. Only run if
		 * the browser support pushState and the request not coming from popstate.
		 *
		 * WordPress has some ways to set paged number:
		 * 1. page/[number], paged=[number] will be directed here.
		 * 2. page=[number]
		 * So, we should check which one the request is used here.
		 *
		 * @since 5.9.8
		 */
		updatePagedNumUrl: function updatePagedNumUrl( id ) {
			// Check pushState browser support and ignore if request come from popstate.
			if ( 'history' in window && 'pushState' in history && id && ! this.popState ) {
				var fullPage = this.pagePathname + this.pageSearch;
				var isQueryPage = false;

				// Style 1 - /page/[number], as default value.
				var newPage = 'page/' + id + '/';
				var expPage = /page\/\d+\/?/;
				var result = this.pagePathname.match( /\/page\/\d+/ );
				var isPagedExist = ( result ) ? true : false;

				// Style 2 - ?page=[number], only run if /page/ is not exist and URL query var exist.
				if ( ! isPagedExist && this.pageSearch ) {
					isQueryPage = this.pageSearch.match( /page\=\d+/ );
					if ( isQueryPage ) {
						newPage = 'page=' + id;
						expPage = /page\=\d+/;
					}
				}

				// If page number is 1, remove paged number from URL.
				if ( id === 1 ) {
					newPage = '';
					if ( isQueryPage ) {
						expPage = ( this.pageSearch.match( /\&+/ ) ) ? /page\=\d+\&?/ : /\?page\=\d+\&?/;
					}
				}

				// Set new pathname. Do replacement only if the new pathname contains paged number.
				var newURL = this.pagePathname + newPage + this.pageSearch;
				if ( fullPage.match( expPage ) ) {
					newURL = fullPage.replace( expPage, newPage );
				}

				// Set history state and return popstate back to false.
				var historyState = {
					MkPagination: {
						url: newURL,
						paged: id
					}
				}
				this.popState = false;

				// Push new pathname to display/hide the paged number.
				window.history.pushState( historyState, null, newURL );
			}
			this.popState = false;
		},

		/**
		 * Get current URL page ID. Notes:
		 * 1. page/[number], paged=[number] will be directed here.
		 * 2. page=[number]
		 *
		 * @return {integer} Current paged ID. Default 1.
		 */
		getURLPagedID: function getURLPagedID() {
			var pathname = window.location.pathname;
			var search = window.location.search;
			var pagedId = 1;
			var result = '';
			var isPagedExist = false;

			// Search based on style 1.
			result = pathname.match( /\/page\/(\d+)/ );
			if ( result ) {
				isPagedExist = true;
				pagedId = ( result.hasOwnProperty( 1 ) ) ? result[1] : 1;
			}

			// Search based on style 2.
			if ( ! isPagedExist && search ) {
				result = search.match( /page\=(\d+)/ );
				if ( result ) {
					isPagedExist = true;
					pagedId = ( result.hasOwnProperty( 1 ) ) ? result[1] : 1;
				}
			}

			return pagedId;
		}
	};

}(jQuery));

(function( $ ) {
	'use strict';

  var MK = window.MK || {};
  window.MK = MK;
  MK.component = window.MK.component || {};

  var val = MK.val,
    utils = MK.utils;

	MK.component.Parallax = function( el ) {
		var self = this,
			$this = $( el ),
        	obj = $this[0],
			$window = $( window ),
		    container = $('.jupiterx-main')[0],
			config = $this.data( 'parallax-config' ),
			$holder = $( config.holder ),
			headerHeight = null,
			offset = null,
			elHeight = null,
			ticking = false,
			isMobile = null;


		var clientRect = null;

		var update = function() {
			// Clear styles to check for natural styles
			// then apply position and size
			obj.style.transform = null;
			obj.style.top = null;
			obj.style.bottom = null;

			isMobile = MK.utils.isMobile();

			if( isMobile ) {
        		$this.css( 'height', '' );
				return;
			}

			clientRect = $this[ 0 ].getBoundingClientRect();
			offset = clientRect.top;
			elHeight = clientRect.height;
			// headerHeight = val.offsetHeaderHeight( offset );
			headerHeight = 150;
      offset = offset - headerHeight + val.scroll();

			setPosition();
			setSize( );
		};


        var h = 0,
        	winH = 0,
        	proportion = 0,
        	height = 0;

        // Position and background attachement should me moved to CSS but we repair it high specificity here as styles are not reliable currently
        var setSize = function() {
        	$this.css( 'height', '' );
        	winH = $window.height() - headerHeight;
        	h = obj.getBoundingClientRect().height;

        	if( config.speed <= 1 && config.speed > 0 ) {
        		if( offset === 0 ) {
	        		$this.css({
	        			backgroundAttachment: 'scroll',
	        			'will-change': 'transform'
	        		});
        		} else {
	        		$this.css({
						height : h + ( (winH - h) * config.speed ),
	        			backgroundAttachment: 'scroll',
	        			'will-change': 'transform'
	        		});
	        	}

        	} else if ( config.speed > 1 && h <= winH ) {
        		$this.css({
        			// good for full heights - 2 because it's viewable by 2 screen heights
        			height: ( winH  +  ( ( winH * config.speed ) - winH ) * 2 ),
        			top: -( ( winH * config.speed ) - winH ),
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		});

        	} else if ( config.speed > 1 && h > winH ) {
        		proportion = h / winH;
        		height = ( winH  +  ( ( winH * config.speed ) - winH ) * (1 + proportion) );

        		$this.css({
        			height: height,
        			top: -( height - (winH * config.speed) ),
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		});

        	} else if ( config.speed < 0 && h >= winH ) {
        		height = h * (1  - config.speed);
        		$this.css({
					height: height + (height - h),
        			top: h - height,
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		});

        	} else if ( config.speed < 0 && h < winH ) {
        		// candidate to change
        		var display = (winH + h) / winH;
        		height = h * -config.speed * display;
        		$this.css({
					height: h + (height * 2),
        			top: -height,
        			backgroundAttachment: 'scroll',
        			'will-change': 'transform'
        		});
        	}
        };


		var currentPoint = null,
			progressVal = null,
			startPoint = null,
			endPoint = null,
			$opacityLayer = config.opacity ? $this.find( config.opacity ) : null,
			scrollY = null;

		var setPosition = function() {
			startPoint = offset - winH;
			endPoint = offset + elHeight + winH - headerHeight;
			scrollY = val.scroll();

			if( scrollY < startPoint || scrollY > endPoint ) {
				ticking = false;
				return;
			}

			currentPoint = (( -offset + scrollY ) * config.speed);

            $this.css({
              	'-webkit-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'-moz-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'-ms-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'-o-transform': 'translateY(' + currentPoint + 'px) translateZ(0)',
              	'transform': 'translateY(' + currentPoint + 'px) translateZ(0)'
            });

			ticking = false;
		};


		var requestTick = function() {
			if( !ticking && !isMobile ) {
				ticking = true;
				window.requestAnimationFrame( setPosition );
			}
		};


		var init = function() {
			update();
			setTimeout(update, 100);
			$window.on( 'load', update );
			$window.on( 'resize', update );
	        window.addResizeListener( container, update );

			$window.on( 'scroll', requestTick );
		};


		return {
			init : init
		};
	};

})( jQuery );

(function($) {
	'use strict';

  var MK = window.MK || {};
  window.MK = MK;
  MK.component = window.MK.component || {};
  MK.ui = window.MK.ui || {};

	MK.component.Preloader = function(el) {
		this.el = el;
	};

	MK.component.Preloader.prototype = {
		init: function init() {
			this.cacheElements();
			this.bindEvents();
		},

		cacheElements: function cacheElements() {
			this.$preloader = $(this.el);
		},

		bindEvents: function bindEvents() {
			this.onLoad(); // all components inited on page load
		},

		onLoad: function onLoad() {
			setTimeout(this.hidePreloader.bind(this), 300);
		},

		hidePreloader: function hidePreloader() {
			this.$preloader.hide();
		}
	};

}(jQuery));

(function($) {
	'use strict';

	// Image added for proportional scaling
	MK.ui.loader = {
		tpl : function() {
			return '<div class="mk-loading-indicator">' +
						'<div class="mk-loading-indicator__inner">' +
							'<div class="mk-loading-indicator__icon"></div>' +
							'<img style="height:100%; width:auto;" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">' +
						'</div>' +
					'</div>';
		},

		add : function(item) {
			$(item).append(this.tpl);
		},

		remove : function(item) {
			if(item) $(item).find('.mk-loading-indicator').remove();
			else $('.mk-loading-indicator').remove();
		}
	};

}(jQuery));

var MK = window.MK || {};
window.MK = MK;
MK.component = window.MK.component || {};

MK.component.ResponsiveImageSetter = (function ($) {

	'use strict';

	var module = {};


	/*---------------------------------------------------------------------------------*/
	/* Private Variables
	/*---------------------------------------------------------------------------------*/

	var viewportClass = getViewportClass();
	var isRetina = window.devicePixelRatio >= 2;


	/*---------------------------------------------------------------------------------*/
	/* Private Methods
	/*---------------------------------------------------------------------------------*/

	function run($imgs) {
		$imgs.filter( function() {
			return !this.hasAttribute("mk-img-src-setted");
		}).each(setSrcAttr);
	}

	function setSrcAttr() {
		var $img = $(this);
		var set = $img.data('mk-image-src-set');
		// Set src attribute to img link suitable for our logic. It will load the image.
		if(set['responsive'] === 'false' && isRetina && set['2x']) $img.attr('src', set['2x']);
		else if(set['responsive'] === 'false') $img.attr('src', set.default);
		else if(viewportClass === 1 && isRetina && set['2x']) $img.attr('src', set['2x']); // default x2 for retina
		else if(viewportClass === 0 && set.mobile) $img.attr('src', set.mobile);
    else $img.attr('src', set.default);

    $img.load(function() {
      $(window).trigger('mk-image-loaded')
    })
	}

	function getViewportClass() {
		if(window.matchMedia('(max-width: 736px)').matches) return 0;
		else return 1;
	}

	function handleResize($imgs) {
		if(!$imgs.length) return; // Do not run if empty collection
		var currentViewportClass = getViewportClass();
		// We don't need to reload bigger images when screen size is decreasing as browser already performs resize operation.
		// Run update on for increasing screen size
		if( currentViewportClass > viewportClass) {
			viewportClass = currentViewportClass; // update for further reference
			run($imgs);
		}
	}


	/*---------------------------------------------------------------------------------*/
	/* Public Methods
	/*---------------------------------------------------------------------------------*/

	module.init = function ($imgs) {

		// Do not run if empty collection
		if(!$imgs.length) return;

		// Run and bind to events
		run($imgs);
	    $imgs.attr('mk-img-src-setted', '');

	};

	module.onResize = function ($imgs) {

		$(window).on( 'resize', MK.utils.throttle( 500, function() {
			handleResize($imgs);
		}));


	};


	module.handleAjax = function () {
    	setTimeout(function ajaxDelayedCallback() { // give it a chance to insert content first
	    	var $newImgs = $('img[data-mk-image-src-set]').filter( function() {
				return !this.hasAttribute("mk-lazyload");
			});
			if(!$newImgs.length) return;
	    	run($newImgs);
    	}, 100);
    }


	return module;

}(jQuery));


jQuery(function($) {

	var init = function init() {
		// Get All Responsive Images
		var $allImages = $('img[data-mk-image-src-set]').filter(function(index) {
			var isNotPortfolioImage = !$(this).hasClass('portfolio-image'),
				isNotBlogImage = $(this).closest('.mk-blog-container').length == 0,
				isNotSwiperImage = !$(this).hasClass('swiper-slide-image'),
				isNotGalleryImage = !$(this).hasClass('mk-gallery-image');
			return isNotPortfolioImage && isNotBlogImage && isNotSwiperImage && isNotGalleryImage;
		});;

		// Handle the resize
		MK.component.ResponsiveImageSetter.onResize($allImages);

		MK.component.ResponsiveImageSetter.init($allImages);

		MK.utils.eventManager.subscribe('ajaxLoaded', MK.component.ResponsiveImageSetter.handleAjax ); // ajax loops
		MK.utils.eventManager.subscribe('ajax-preview', MK.component.ResponsiveImageSetter.handleAjax ); // ajax portfolio
		MK.utils.eventManager.subscribe('quickViewOpen', MK.component.ResponsiveImageSetter.handleAjax );
	}
	init();
	$(window).on('vc_reload', init);

});



(function( $ ) {
	'use strict';

  var MK = window.MK || {};
  window.MK = MK;
  MK.utils = window.MK.utils || {};
  MK.val = window.MK.val || {};

	/**
	 * Keep track of top Level sections so we can easly skip to next one.
	 * We must be explicit about DOM level to nested sections.
	 * The list of sections is static. If you'd need to refreh it on ajax etc do it with pub/sub (not really needed now).
	 * We keep track for the same sections in Footer for mutating window location with '!loading' to prevent native anchor behaviour.
	 */
	var $topLevelSections = $('.jupiterx-main > .vc_row, .jupiterx-main > .mk-main-wrapper-holder, .jupiterx-main > .mk-page-section');

  $( document ).on( 'click', '.mk-skip-to-next', function() {
    var $this = $( this ),

    /**
     * Static height of button + the space to the bottom of the container.
     *
     * @TODO Possible to calculate dynamically.
     */
    btnHeight = $this.hasClass( 'edge-skip-slider' ) ? 150 : 76,
    offset = $this.offset().top + btnHeight,
    nextOffset = MK.utils.nextHigherVal( MK.utils.offsets( $topLevelSections ), [offset] );

    MK.utils.scrollTo( nextOffset  );
  });

})( jQuery );


(function($) {

    'use strict';

    var SkillDiagram = function( el ) {
        this.el = el;
    }

    SkillDiagram.prototype = {
        init : function() {
            this.cacheElements();
            this.createDiagram();
            this.$skills.each( this.createSkill.bind( this ) );
        },

        cacheElements : function() {
            this.$el = $( this.el );
            this.$skills = this.$el.find( '.mk-meter-arch');
            this.config  = this.$el.data();
            this.config.radius = this.config.dimension / 2;
        },

        random : function( l, u ) {
            return Math.floor( ( Math.random() * ( u - l + 1 ) ) + l );
        },

        createDiagram : function() {
            var self = this;
            $(this.el).find('svg').remove();

            this.diagram = Raphael( this.el, this.config.dimension, this.config.dimension );

            // Make svg scalable in different screen sizes
            this.diagram.setViewBox(0,0,this.config.dimension,this.config.dimension,true);
            this.diagram.setSize('90%', '90%');

            this.diagram.circle( this.config.radius, this.config.radius, 80 ).attr({
                stroke: 'none',
                fill: this.config.circleColor
            });

            // Export title
            this.title = this.diagram.text( this.config.radius, this.config.radius, this.config.defaultText ).attr({
                font: "22px helvetica",
                fill: this.config.defaultTextColor
            }).toFront();

            this.diagram.customAttributes.arc = function(value, color, rad){
                var v = 3.6 * value,
                    alpha = v == 360 ? 359.99 : v,
                    r  = self.random( 91, 240 ),
                    a  = (r - alpha) * Math.PI/180,
                    b  = r * Math.PI/180,
                    sx = self.config.radius + rad * Math.cos(b),
                    sy = self.config.radius - rad * Math.sin(b),
                    x  = self.config.radius + rad * Math.cos(a),
                    y  = self.config.radius - rad * Math.sin(a),
                    path = [['M', sx, sy], ['A', rad, rad, 0, +(alpha > 180), 1, x, y]];

                return {
                    path: path,
                    stroke: color
                }
            }
        },

        createSkill : function( id, el ) {
            var self   = this,
                $this  = $( el ),
                config = $this.data(),
                radMin = 72,
                radVal = 27,
                newRad = radMin + ( radVal * (id + 1) );

            var $path = this.diagram.path().attr({
                'stroke-width': 28,
                arc: [config.percent, config.color, newRad]
            });

            $path.mouseover( function() {
                self.showSkill( this, config.name, config.percent );
            }).mouseout( function() {
                self.hideSkill( this )
            });
        },

        showSkill : function( self, name, percent ) {
            var $this = self,
                time = 250;

            //solves IE problem
            if(Raphael.type != 'VML') $this.toFront();

            $this.animate({
                'stroke-width': 50,
                'opacity': 0.9,
            }, 800, 'elastic' );

            this.title.stop()
                .animate({ opacity: 0 }, time, '>', function(){
                    this.attr({ text: name + '\n' + percent + '%' }).animate({ opacity: 1 }, time, '<');
                }).toFront();
        },

        hideSkill : function( self ) {
            var $this = self,
                self = this,
                time = 250;

            $this.stop().animate({
                'stroke-width': 28,
                opacity: 1
            }, time * 4, 'elastic' );

            self.title.stop()
                .animate({ opacity: 0 }, time, '>', function(){
                    self.title.attr({ text: self.config.defaultText })
                    .animate({ opacity: 1 }, time, '<');
                });
        }
    }

    var init = function init() {
        if( typeof Raphael === 'undefined' ) return;
        $( '.mk-skill-diagram' ).each( function() {
            var diagram = new SkillDiagram( this );
                diagram.init();
        });
    }

    init();
    $(window).on('vc_reload', init);

})(jQuery);

/* Skill Meter and Charts */
/* -------------------------------------------------------------------- */
function mk_skill_meter() {
  "use strict";
  if ($.exists('.mk-skill-meter')) {
        if (!MK.utils.isMobile()) {
            $(".mk-skill-meter .progress-outer").each(function() {
                var $this = $(this);

                var build = function() {
                    if (!$this.hasClass('scroll-animated')) {
                        $this.addClass('scroll-animated');
                        $this.animate({
                            width: $this.attr("data-width") + '%'
                        }, 2000);
                    }
                };

                MK.utils.scrollSpy( this, {
                    position: 'bottom',
                    after: build
                });
            });
        } else {
            $(".mk-skill-meter .progress-outer").each(function() {
                var $this = $(this);
                if (!$this.hasClass('scroll-animated')) {
                    $this.addClass('scroll-animated');
                    $this.css({
                        width: $(this).attr("data-width") + '%'
                    });
                }
            });
        }
    }
}

// function mk_charts() {
//     "use strict";

//     if( !$.exists('.mk-chart') ) return;

//     MK.core.loadDependencies([ MK.core.path.plugins + 'jquery.easyPieChart.js' ], function() {

//         $('.mk-chart').each(function() {

//             var $this = $(this),
//                 $parent_width = $(this).parent().width(),
//                 $chart_size = parseInt($this.attr('data-barSize'));

//             if ($parent_width < $chart_size) {
//                 $chart_size = $parent_width;
//                 $this.css('line-height', $chart_size);
//                 $this.find('i').css({
//                     'line-height': $chart_size + 'px'
//                 });
//                 $this.css({
//                     'line-height': $chart_size + 'px'
//                 });
//             }

//             var build = function() {
//                 $this.easyPieChart({
//                     animate: 1300,
//                     lineCap: 'butt',
//                     lineWidth: $this.attr('data-lineWidth'),
//                     size: $chart_size,
//                     barColor: $this.attr('data-barColor'),
//                     trackColor: $this.attr('data-trackColor'),
//                     scaleColor: 'transparent',
//                     onStep: function(value) {
//                         this.$el.find('.chart-percent span').text(Math.ceil(value));
//                     }
//                 });
//             };

//             // refactored only :in-viewport logic. rest is to-do
//             MK.utils.scrollSpy( this, {
//                 position: 'bottom',
//                 after: build
//             });


//         });
//     });
// }

(function($) {
  'use strict';

  var MK = window.MK || {};
  window.MK = MK;
  MK.ui = window.MK.ui || {};

	//
	// Constructor
	//
	// /////////////////////////////////////////////////////////

	MK.ui.Slider = function( container, config ) {

		var defaults = {
				slide 				: '.mk-slider-slide',
	            nav 	     		: '.mk-slider-nav',
                effect              : 'roulete',
                ease 				: 'easeOutQuart', // should not be changed, remove
                slidesPerView       : 1,
                slidesToView        : 1,
                transitionTime      : 700,
                displayTime         : 3000,
                autoplay            : true,
                hasNav              : true,
                hasPagination       : true,
                paginationTpl 		: '<span></span>',
                paginationEl 		: '#pagination',
                draggable           : true,
                fluidHeight 		: false,
                pauseOnHover		: false,
                lazyload			: false,
                activeClass 		: 'is-active',
                edgeSlider	 		: false,
                spinnerTpl 			: '<div class="mk-slider-spinner-wrap"><div class="mk-slider-spinner-fallback"></div><svg class="mk-slider-spinner" viewBox="0 0 66 66" xmlns="http://www.w3.org/2000/svg"><circle class="mk-slider-spinner-path" fill="none" stroke-width="4" stroke-linecap="round" cx="33" cy="33" r="30"></circle></svg></div>',
                onInitialize 		: function() {},
                onAfterSlide 		: function( id ) {},
                onBeforeSlide 		: function( id ) {}
		};

		this.state = {
			id 						: 0,
			moveForward 			: true,
			running   				: false,
            zIFlow					: null,
            stop 					: false,
		};

		this.config = $.extend( defaults, config );
		this.container = container;

		this.initPerView = this.config.slidesPerView;

		// Timer holder
		this.activeTimer = null;
		this.autoplay = null;
		this.timer = null;
		this.timerRemaining = parseInt(this.config.displayTime);

		// Boolean 'Em All, Making sure it's not string
		this.config.lazyload = JSON.parse(this.config.lazyload);
		this.config.edgeSlider = JSON.parse(this.config.edgeSlider);

		// Image Loader Instance
		this.imageLoader = null;

		// Add abort command to imagesLoaded, Placing it inside script makes it to work with different versions
		// of imagesLoaded if loaded by other Plugins
		imagesLoaded.prototype.abort = function() {
			this.progress = this.complete = function() { };
		};
	};



	//
	// Shared methods
	//
	// /////////////////////////////////////////////////////////

	MK.ui.Slider.prototype = {

		init : function() {
			this.setPerViewItems();
			this.cacheElements();
			this.getSlideSize();
			this.bindEvents();
            this.setSize();
			this.setPos();

			// Hack for preparing 'prev' on first click if needed
			this.updateId( -1 );
			this.updateId( 1 );

			this.val = this.dynamicVal();
			this.timeline = this.prepareTimeline( this.config.transitionTime );

			this.timeline.build();

			if( this.config.hasPagination ) { this.buildPagination(); }

			if( this.config.autoplay && document.hasFocus() ) { this.setTimer(); }

			if( typeof this.config.onInitialize === 'function' ) {
				this.config.onInitialize( this.slides );
			}

			if( this.config.fluidHeight === true ) {
				$( this.slides ).height( 'auto' );
				$( this.container ).css( 'transition', 'height ' + 200 + 'ms ease-out' );
				this.setHeight( 0 );
			}


			if( this.config.fluidHeight === 'toHighest' ) {
				this.setHeightToHighest();
			}

			// Create timer per slide if required
			$(this.slides).each(this.createTimer);

			// If it's Edge Slider and Lazy Load is enabled
			if ( this.config.lazyload && this.config.edgeSlider ) {

				// If It's not a Video Slide
				if ( $(this.slides[this.state.id]).find('video').length === 0 ) {
					// Set the first slide's BG image
					var $slideImg = $(this.slides[this.state.id]).children('[data-mk-img-set]');
					MK.component.BackgroundImageSetter.init( $slideImg );
				}
				$(this.config.spinnerTpl).prependTo( this.$slides );

			} else {

				// Set all slides's BG images
				MK.component.BackgroundImageSetter.init( $(this.slides).children('[data-mk-img-set]') );

			}



		},


		cacheElements : function () {
			this.container = this.isNode( this.container ) ? this.container
				: document.querySelectorAll( this.container )[0];
			this.slides = this.container.querySelectorAll( this.config.slide );
			this.$slides = $(this.slides);

			if( this.config.hasNav ) { this.$nav = $( this.config.nav ); }
			if( this.config.hasPagination ) { this.$pagination = $( this.config.paginationEl ); }
		},


		bindEvents : function() {
			var $window = $( window );

			if( this.config.slidesPerView > 1 ) { $window.on( 'resize', this.setPerViewItems.bind( this ) ); }
			if( this.config.hasNav ) { this.eventsNav(); }
			if( this.config.hasPagination ) { this.eventsPag(); }
			if( this.config.draggable ) { this.dragHandler(); }
			if( this.config.autoplay ) {
				$window.on( 'focus', this.windowActive.bind( this ) );
				$window.on( 'blur', this.windowInactive.bind( this ) );
			}
			if( this.config.pauseOnHover ) {
				$(this.container).on( 'mouseleave', this.setTimer.bind( this ) );
				$(this.container).on( 'mouseenter', this.unsetTimer.bind( this ) );
			}
			if( this.config.fluidHeight === 'toHighest' ) {
				$window.on( 'resize', this.setHeightToHighest.bind( this ) );
			}
		},


		setPerViewItems: function() {
			if(window.matchMedia( '(max-width: 500px)' ).matches) { this.config.slidesPerView = 1; }
			else if(window.matchMedia( '(max-width: 767px)' ).matches && this.initPerView >= 2 ) { this.config.slidesPerView = 2; }
			else if(window.matchMedia( '(max-width: 1024px)' ).matches && this.initPerView >= 3 ) { this.config.slidesPerView = 3; }
			else { this.config.slidesPerView = this.initPerView; }

        	if( typeof this.slides === 'undefined' ) return;
			this.getSlideSize();
			this.setSize();
			this.setPos();
			this.timeline = this.prepareTimeline( this.config.transitionTime );
			this.timeline.build();
		},


		eventsNav : function() {
			this.$nav.on( 'click', 'a', this.handleNav.bind( this ) );
		},


		eventsPag : function() {
			this.$pagination.on( 'click', 'a', this.handlePagination.bind( this ) );
		},


		handleNav : function( e ) {
			e.preventDefault();

			if( this.state.running ) { return; }
			this.state.running = true;

			var $this = $( e.currentTarget ),
				moveForward = $this.data( 'direction' ) === 'next';


			if( this.config.autoplay ) {
				this.unsetTimer();
				setTimeout( this.setTimer.bind( this ), this.config.transitionTime );
			}

			this.state.moveForward = moveForward;
			this.timeline.build();
			this.timeline.play();

			this.setActive( this.nextId( moveForward ? 1 : -1 ) );
			if( this.config.fluidHeight ) { this.setHeight( this.nextId( moveForward ? 1 : -1 ) ); }
		},


		handlePagination : function( e ) {
			e.preventDefault();

			var $this = $( e.currentTarget ),
				id = $this.index();

			this.goTo( id );
		},


		reset: function() {
			this.state.stop = true;
			this.state.id = 0;
			this.setPos();
			this.unsetTimer();
			this.setTimer();
		},


		goTo : function(id) {
			if( this.state.running ) { return; }
			this.state.running = true;

			var lastId = this.state.id;

			if( lastId === id ) {
				return;
			} else if( lastId < id ) {
				this.state.moveForward = true;
			} else {
				this.state.moveForward = false;
			}

			if( this.config.autoplay ) {
				this.unsetTimer();
				setTimeout( this.setTimer.bind( this ), this.config.transitionTime );
			}

			this.timeline.build( Math.abs( lastId - id ) );
			this.timeline.play();

			this.setActive( id );
			if( this.config.fluidHeight ) { this.setHeight( id ); }
		},


		windowActive : function() {
			this.setTimer(false, true);
			$(this.container).removeClass('is-paused');
		},


		windowInactive : function() {
			this.unsetTimer();
			$(this.container).addClass('is-paused');
		},


		updateId : function( val ) {
			this.state.id = this.nextId(val);
		},

		nextId : function( val ) {
			var len = this.slides.length,
				insertVal = this.state.id + val;
				insertVal = ( insertVal >= 0 ) ? insertVal : len + val;
				insertVal = ( insertVal >= len ) ? 0 : insertVal;

			return insertVal;
		},


		setStyle : function( obj, style ) {
            var hasT = style.transform,
            	t = {
	                x       : ( hasT ) ? style.transform.translateX : null,
	                y       : ( hasT ) ? style.transform.translateY : null,
	                scale   : ( hasT ) ? style.transform.scale 		: null,
	                rotate  : ( hasT ) ? style.transform.rotate 	: null,
	                rotateX : ( hasT ) ? style.transform.rotateX 	: null,
	                rotateY : ( hasT ) ? style.transform.rotateY 	: null
           		},
				z  = 'translateZ(0)',
            	x  = (t.x) ?  'translateX(' + t.x + '%)' 		: 'translateX(0)',
                y  = (t.y) ?  'translateY(' + t.y + '%)' 		: 'translateY(0)',
                s  = (t.scale)  ?  'scale(' + t.scale + ')' 	: 'scale(1)',
                r  = (t.rotate) ? 'rotate(' + t.rotate + 'deg)' : 'rotate(0)',
                rX = (t.rotateX) ? 'rotateX(' + t.rotateX + 'deg)' : '',
                rY = (t.rotateY) ? 'rotateY(' + t.rotateY + 'deg)' : '',

           		o = style.opacity,
           		h = style.height,
           		w = style.width;

            var c = z + x + y  + s + r + rX + rY;

            if( c.length ) {
	            obj.style.webkitTransform 	= c;
	            obj.style.msTransform 		= c;
	            obj.style.transform 		= c;
	        }

            if( typeof o === 'number' ) { obj.style.opacity = o; }
            if( h ) { obj.style.height  = h + '%'; }
            if( w ) { obj.style.width   = w + '%'; }
		},


		setPos : function() {
        	if( typeof this.slides === 'undefined' ) return;
		    var id 			= this.state.id,
		    	i 			= 0,
		    	len 		= this.slides.length,
		    	animation 	= this.animation[ this.config.effect ],
		    	axis 		= animation.axis,
				animNext	= animation.next,
				animActi 	= animation.active,
				animPrev 	= animation.prev,
                perView 	= this.config.slidesPerView,
                slideId 	= null,
                zIFlow 		= null,
                style 		= {};

            style.transform = {};


            for( ; i < len; i += 1 ) {
                if(i < perView) {
                	// Position for visible slides. Apply active styles
                	style = animActi;
                    style.transform[ 'translate' + axis ] = i * 100;
                } else {
                	// Rest slides move after edge based on axis and moveForward. Apply Next / Prev styles
                	style = this.state.moveForward ? animNext : animPrev;
                    style.transform[ 'translate' + axis ] =  this.state.moveForward ? perView * 100 : -100;
                }

                this.slides[ i ].style.zIndex = 0;

                slideId = ( i + id ) % len;
                this.setStyle( this.slides[ slideId ], style );
            }
		},


        // When we're setting animation along Y axis we're going to set up height
        // otherwise width. It is shared amongst all slides
        setSize : function() {
        	if( typeof this.slides === 'undefined' ) return;
        	var i = 0,
		    	len = this.slides.length,
		    	axis = this.animation[ this.config.effect ].axis,
                slideSize = this.slideSize,
        		style = {};

            if( axis === 'Y' ) {
                style.height = slideSize[ axis ];
            } else {
                style.width = slideSize[ axis ];
            }

            for( ; i < len; i += 1 ) {
                this.setStyle( this.slides[ i ], style );
            }
        },


        setHeight : function( id ) {
			var $slides = $( this.slides ),
				$activeSlide = $slides.eq( id );

        	var currentHeight = $activeSlide.height();
        	$( this.container ).height( currentHeight );
        },


        setHeightToHighest : function() {
        	// this is becouse of alliginig woocommrece carousel. Too much DOM
        	// Refactor someday
			var $slides = $( this.slides ),
				height = 0;

        	$slides.each(function() {
        		height = Math.max(height, $(this).find('> div').outerHeight());
        	});

        	$( this.container ).height( height );
        },


        // Little utility inspired by GreenSock.
        // We export this to this.timeline on init.
        prepareTimeline : function( time ) {
			var self 		= this,
				iteration 	= 0,
            	totalIter 	= time / (1000 / 60),
            	animLoop 	= [],
            	aL 			= 0, // animation length
            	loops 		= 1,
				ease 		= this.config.ease,
				currentStyle, timeProg,
				build, move, add, play, reverse, progress, kill;


			// Build constants, run them only once
			// take out possibly
			var len 		= this.slides.length,
				perView   	= this.config.slidesPerView,
				animation 	= this.animation[ this.config.effect ],
				animAxis 	= animation.axis,
				animNext	= animation.next,
				animActi 	= animation.active,
				animPrev 	= animation.prev,
				style 		= {},
				slideId 	= null,
				zIFlow 		= null;

				style.transform = {};


			build = function( repeats ) {
				var currentEase = ease;
				loops = repeats || loops;

				// console.log('build', loops);

				if( !loops ) { return; }
				if( loops > 1 ) {
					currentEase = 'linearEase';
				}

				// clean before running new build
				kill();
				// set new positions
				self.setPos();

				var id = self.state.id,
					moveForward = self.state.moveForward,
					i = 0,
					axisMove = (moveForward) ? -100 : 100;

				for( ; i <= perView; i += 1 ) {
					slideId = ( (moveForward) ? i + id : i + id - 1 ) % len;
					slideId = ( slideId < 0 ) ? len + slideId : slideId;

					if( i === 0 ) {
						style = moveForward ? animPrev : animActi;
					} else if( i === perView ) {
						style = moveForward ? animActi : animNext;
					} else {
						style = animActi;
	            	}

               	 	zIFlow = (self.state.moveForward) ? animNext.zIndex : animPrev.zIndex;
	                if( zIFlow ) {
	                	// console.log( zIFlow );
	                	self.slides[ slideId ].style.zIndex = (zIFlow === '+') ? i + 1 : len - i;
	                }

					style.transform[ 'translate' + animAxis ] = axisMove;
	            	add( self.slides[ slideId ], style, currentEase );
				}
			};

			add = function( slide, toStyles, ease ) {
				if( typeof slide === 'undefined' ) {
					throw 'Add at least one slide';
				}

	            var fromStyles = slide.style,
					style = self.refStyle( toStyles, fromStyles );

				animLoop.push( [slide, style, ease] );
				aL += 1;
			};

			move = function( startProg, mode ) {
				var currentTotalIter = totalIter;

				if( loops > 1 ) {
				 	currentTotalIter = totalIter / 5;
				}

				if( !self.state.running ) { self.state.running = true; }

				if( startProg ) {
					// update iteration val to cached outside var
					// ceil to handle properly play after mouse up / touch end
					iteration = Math.ceil(startProg * currentTotalIter);
				}

				timeProg = iteration / currentTotalIter;
				progress( timeProg );

				// Break loop
				if( iteration >= currentTotalIter && mode === 'play' ||
					iteration <= 0 && mode === 'reverse' ) {

					self.state.running = false;
					iteration = 0;
					kill();
	            	self.updateId( self.state.moveForward ? 1 : -1 );
					// If we're creating multiple animation loop we trigger outside only first pass to start all game.
					// the rest are triggered as callback
					loops -= 1;
					if( loops > 0 ) {
						build();
						play();
					}

					// if we run all loops reset back the default value
					if( !loops ) {
						loops = 1;
						self.timerRemaining = parseInt(self.config.displayTime);
						self.config.onAfterSlide( self.state.id );
					}

					return;
				}

				// Run in given mode
				if( mode === 'play') {
					iteration += 1;
				} else {
					iteration -= 1;
				}

				requestAnimationFrame( function() {
					if(self.state.stop) return;
					move( 0, mode );
				});
			};

			play = function( startProg ) {

				var $nextSlide = $(self.slides[ self.nextId(self.state.moveForward ? 1 : -1) ] );

				// If it's Edge Slider and Lazy Load is enabled and It's not a Video Slide
				if ( self.config.lazyload && self.config.edgeSlider ) {

					// Set the next slide's BG Image
					var $slideImg = $nextSlide.find('[data-mk-img-set]');
					if ( $slideImg.length ) {
						MK.component.BackgroundImageSetter.init( $slideImg );
					}

				}

				self.config.onBeforeSlide( self.nextId(self.state.moveForward ? 1 : -1) );
				var start = startProg || 0;
				iteration = 0;
				self.state.stop = false;
				move( start, 'play' );

			};

			reverse = function( startProg ) {
				var start = startProg || 1;
				move( start, 'reverse' );
			};

			progress = function( progVal ) {
            	var aI = 0,
            		currentStyle;

				for( aI; aI < aL; aI++ ) {
					if( progVal !== 1 && progVal !== 0 ) {
						currentStyle = self.currentStyle( progVal, animLoop[ aI ][ 1 ], animLoop[ aI ][ 2 ] );
					} else if( progVal === 1) {
						currentStyle = self.currentStyle( progVal, animLoop[ aI ][ 1 ], 'linearEase' );
					} else if ( progVal === 0 ) {
						currentStyle = self.currentStyle( progVal, animLoop[ aI ][ 1 ], 'linearEase' );
					}
					self.setStyle( animLoop[ aI ][ 0 ], currentStyle );
				}
			};

			// Clear previous loop
			kill = function() {
				animLoop = [];
            	aL = 0;
			};


			return {
				build 		: build,
				add 		: add,
				play 		: play,
				reverse 	: reverse,
				progress 	: progress
			};
		},


		// Build reference styles.
		// Return object with array containig initial style and change of its value
		// as required for easing functions
		refStyle : function( toStyles, fromStyles ) {
			var axis = this.animation[ this.config.effect ].axis,
            	style = {},
				initVal, changeVal, endVal, dynamicEnd, styleProp, transProp, transform;

			for( styleProp in toStyles ) {

				if( styleProp === 'transform' ) {
					transform = this.getTransforms( fromStyles );
					style.transform = {};

					for( transProp in toStyles.transform ) {
						// don't care about z
						if( transProp === 'translateZ' ) { continue; }

						initVal = transform[ transProp ] || 0; // if it is undefined it means it's 0
						dynamicEnd = ( transProp === 'translate' + axis ) ? initVal : 0;
						endVal  = toStyles.transform[ transProp ] + dynamicEnd; // it is dynamic, based on slide position in current set
						changeVal = endVal - initVal;
						style.transform[ transProp ] = [ initVal, changeVal ];
					}
				} else if( styleProp === 'zIndex' ) {
					// console.log( 'z' );
					continue;
				} else {
					initVal = parseFloat( fromStyles[ styleProp ] ) || 0; // if it is undefined it means it's 0
					endVal  = toStyles[ styleProp ];
					changeVal = endVal - initVal;
					style[ styleProp ] =  [ initVal, changeVal ];
				}
			}

			return style;
		},


		currentStyle : function( progress, style, ease ) {
			var self = this,
				currentStyle = {},
            	currentVals, styleProp, transProp, prog;

			// Redo same loop but construct currentStyle object out of cached values
			for( styleProp in style ) {

				if( styleProp === 'transform' ) {
					currentStyle.transform = {};

					for( transProp in style.transform ) {
						// remove this line. double check first if needed by logging
						if( transProp === 'translateZ' ) { continue; }

						currentVals = style.transform[ transProp ];
						currentStyle.transform[ transProp ] =
							// (currentIteration, startValue, changeInValue, totalIterations)
								self.ease[ ease ]( progress, currentVals[ 0 ], currentVals[ 1 ], 1 );
					}
				} else {
					currentVals = style[ styleProp ];
					currentStyle[ styleProp ] =
						self.ease[ ease ]( progress, currentVals[ 0 ], currentVals[ 1 ], 1 );
				}
			}

			return currentStyle;
		},


		setActive : function( id ) {
			var $slides = $( this.slides ),
				className = this.config.activeClass;

			$slides.removeClass( className );

			if( this.config.hasPagination ) {
				var $pagination = this.$pagination.find( 'a' );
				$pagination.removeClass( className );
				$pagination.eq( id ).addClass( className );
			}

			if( this.activeTimer ) {
				clearTimeout( this.activeTimer );
				if ( this.imageLoader ) {
					this.imageLoader.abort();
				}
			}


			var self = this;

			this.activeTimer = setTimeout( function() {

				var $currentSlide = $slides.eq( id );

				if ( self.config.lazyload && self.config.edgeSlider ) {  // If it's Edge Slider and Lazy Load is enabled

					if ( $currentSlide.find('.mk-section-video').length && $currentSlide.children('.mk-video-section-touch').length ) {  // If it's a Video Slide and has a Preview image

						var imgSet = $currentSlide.children('.mk-video-section-touch').data('mk-img-set');
						var exactImg = MK.component.BackgroundImageSetter.getImage( imgSet );
						var $bgImage = $('<img>').attr('src', exactImg );

						self.imageLoader = imagesLoaded( $bgImage[0], function( instance ) {
							$currentSlide.children('.mk-slider-spinner-wrap').addClass('mk-slider-spinner-wrap-hidden');
							setTimeout( function() {
						 		$currentSlide.children('.mk-slider-spinner-wrap').hide();
						 	}, 200);
							$currentSlide.addClass( className );
					 	});

					} else if ( $currentSlide.find('.mk-section-video').length && $currentSlide.children('.mk-video-section-touch').length === 0 ) { // If it's a Video Slide and has NOT a Preview image

						$currentSlide.children('.mk-slider-spinner-wrap').addClass('mk-slider-spinner-wrap-hidden');
						setTimeout( function() {
					 		$currentSlide.children('.mk-slider-spinner-wrap').hide();
					 	}, 200);
						$currentSlide.addClass( className );

					} else {  // If it's a Image Slide

						if ( $currentSlide.children('[data-mk-img-set]').length ) {
							// Get the matching Image URL to start lazy loading
							var imgSet = $currentSlide.children('[data-mk-img-set]').data('mk-img-set');
							var exactImg = MK.component.BackgroundImageSetter.getImage( imgSet );
							var $bgImage = $('<img>').attr('src', exactImg );

							// Prevent counting time on slide until the image loads
							self.unsetTimer();
							self.imageLoader = imagesLoaded( $bgImage[0], function( instance ) {
								// Hide spinner, Continue counting time on slide and show the content
							 	$currentSlide.children('.mk-slider-spinner-wrap').addClass('mk-slider-spinner-wrap-hidden');
							 	setTimeout( function() {
							 		$currentSlide.children('.mk-slider-spinner-wrap').hide();
							 	}, 200);
								self.setTimer(false, false, $currentSlide.data('timer') || Number(self.config.displayTime) );
								$currentSlide.addClass( className );
							});
						} else {
							$currentSlide.children('.mk-slider-spinner-wrap').addClass('mk-slider-spinner-wrap-hidden');
						 	setTimeout( function() {
						 		$currentSlide.children('.mk-slider-spinner-wrap').hide();
						 	}, 200);
							self.setTimer(false, false, $currentSlide.data('timer') || Number(self.config.displayTime) );
							$currentSlide.addClass( className );
						}

					}

				} else {

					$currentSlide.addClass( className );

				}


			}, this.config.transitionTime );
		},

		createTimer : function() {

			var $slide = $(this),
				video = $slide.find('video').get(0);

			if(video) {
				// A hacky but reliable way to ge the video duration
				var interval = setInterval( function() {
					// If the metadata is ready
					if ( video.readyState > 0 ) {
						$slide.data('timer', (video.duration * 1000));
						$slide.attr('data-timer', (video.duration * 1000));
						clearInterval(interval);
					}
				}, 100);
			}

		},

		setTimer : function( isFirst, isPaused, fixed_time ) {
			// check for custom timer
			var customTimer = this.$slides.eq(this.nextId(this.state.moveForward ? 1 : -1)).data('timer'),
				trans = parseInt( this.config.transitionTime ),
				interval = customTimer ? customTimer : parseInt( this.config.displayTime ),
				timer = interval + trans;

			var self  = this,
				first = isFirst || true,
				fixed_time = fixed_time || 0,
				create, run;

			this.timer = true;
			this.lastSetTimer = Date.now();

			create = function() {

				if( self.autoplay ) { clearTimeout( self.autoplay ); }
				if( !self.timer ) {
					return;
				}
				self.state.moveForward = true;
				self.timeline.build();
				self.timeline.play();
				self.setActive( self.nextId( 1 ) );
				if( self.config.fluidHeight ) { self.setHeight( self.nextId( 1 ) ); }
				first = false;
				self.lastSetTimer = Date.now();

				run();
			};

			run = function(newInterval) {
				// check for custom timer
				customTimer = self.$slides.eq(self.nextId(self.state.moveForward ? 1 : -1)).data('timer');
				interval = customTimer ? customTimer : parseInt( self.config.displayTime );
				timer = interval + trans; // update timer with current val

				var time = newInterval || timer;
				self.autoplay = setTimeout( create, time );
			};

			if ( fixed_time ) {
				run( fixed_time );
			} else if (isPaused) {
				run( this.timerRemaining );
			} else {
				run();
			}
		},


		unsetTimer : function() {
			this.timer = false;
			this.lastUnsetTimer = Date.now();
			this.timerRemaining -= this.lastUnsetTimer - this.lastSetTimer;
			if( this.autoplay ) { clearTimeout( this.autoplay ); }
		},


		buildPagination : function() {
			var i   = 0,
				len = this.slides.length,
				tpl = '';

			for( ; i < len; i += 1 ) {
				tpl += '<a href="javascript:;">' + this.config.paginationTpl + '</a>';
			}

			this.$pagination.html( tpl );
			this.setActive( 0 );
		},


		getSlideSize : function() {
			this.slideSize = {
                X: 100 / this.config.slidesPerView,
                Y: 100 / this.config.slidesPerView
            };
		},


		getTransforms : function( style ) {
			// console.log( style );
		    var transform = style.transform || style.webkitTransform || style.mozTransform,
		    	regex = /(\w+)\(([^)]*)\)/g,
				match,
				T = {};

			if( typeof transform !== 'string' ) {
				throw 'Transform prop is not a string.';
			}

		    if( !transform ) { return; }

			// Run regex assignment
			while( match = regex.exec( transform ) ) {
				T[ match[ 1 ] ] = parseFloat( match[ 2 ] );
			}

		    return T;
		},

		isNode : function( o ) {
			return (
		    	typeof Node === "object" ? o instanceof Node :
		   			o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName==="string"
		  	);
		},


		dragHandler : function() {
			var self = this,
				$container = $( this.container ),
				prevBuild = false,
				nextBuild = false,
				dragging = false,
				buffor = 5, // helpful for decoupling with click events
				dragStart, dragMove, dragEnd, progress;

			progress = function( moveX ) {
				return moveX / self.val.viewportW();
			};

			dragStart = function( moveX, startX ) {
				// console.log( 'start', moveX, startX );
			};

			dragMove = function( moveX ) {
				// console.log('move');
				if( self.state.running ) return;

				// Don't need to check for existance here

				if( moveX < -buffor ) {

					if( !nextBuild ) {
						self.state.moveForward = true;
						self.timeline.build();
						nextBuild = true;
						prevBuild = false;
						self.unsetTimer();
					} else {
						// turn progress into positive val
						self.timeline.progress( -progress( moveX ) );
					}
					dragging = true;
				} else if( moveX > buffor ) {

					if( !prevBuild ) {
						self.state.moveForward = false;
						self.timeline.build();
						prevBuild = true;
						nextBuild = false;
						self.unsetTimer();
					} else {
						self.timeline.progress( progress( moveX ) );
					}
					dragging = true;
				}
			};

			dragEnd = function( moveX ) {
				if( dragging ) {
					var prog = progress( moveX ),
						absProg = prog < 0 ? -prog : prog;

					if( absProg > 0.1 ) {
						self.timeline.play( absProg );
						self.setActive( self.nextId( prog < 0 ? 1 : -1 ) );
						if( self.config.fluidHeight ) { self.setHeight( self.nextId( prog < 0 ? 1 : -1 ) ); }
					} else {
						self.timeline.reverse( absProg );
						// eventually move this to reverse callbacks
						if(prog < 0) {
							self.updateId( -1 );
						} else {
							self.updateId( 1 );
						}
					}

					prevBuild = false;
					nextBuild = false;
					dragging = false;
					if( self.config.autoplay ) { self.setTimer( false ); }
				}
			};

			this.drag( $container, dragStart, dragMove, dragEnd );
		},


		drag : function( $el, startFn, moveFn, stopFn ) {

		    var touchX, touchY, movX, movY, go, evt,
		   		prevent, start, move, stop;

		    prevent = function( e ) {
		        e.preventDefault();
		    };

		    start = function( e ) {
		        // $el.on("touchmove", prevent);
		        $el.on("mousemove", prevent);
		        $el.on("touchmove", move);
		        $el.on("mousemove", move);

		        evt = (e.type === 'touchstart') ? e.originalEvent.touches[0] : e;
		        touchX = evt.pageX;

		        if(typeof startFn === 'function') {
		        	startFn(movX, touchX);
		        }
		    };

		    move = function( e ) {
		        evt = (e.type === 'touchmove') ? e.originalEvent.touches[0] : e;
		        movX = evt.pageX - touchX;

	        	if(typeof moveFn === 'function') {
		        	moveFn(movX);
		        }
		    };

		    stop = function( e ) {
		        // $el.off("touchmove", prevent);
		        $el.off("mousemove", prevent);
		        $el.off("touchmove", move);
		        $el.off("mousemove", move);

		    	if(typeof stopFn === 'function') {
		        	stopFn(movX);
		        }
		    };

		    $el.on("touchstart", start);
		    $el.on("mousedown", start);
		    $el.on("touchend", stop);
		    $el.on("touchleave", stop);
		    $el.on("touchcancel", stop);
		    $el.on("mouseup", stop);
		    $el.on("mouseleave", stop);
		},


		dynamicVal : function() {
			var $window = $( window ),
				update,
				getViewportW, viewportW;

			update = function() {
 				viewportW = $window.width();
			};

			getViewportW = function() {
				return viewportW;
			};

			update();
			$window.on( 'load', update );
			$window.on( 'resize', update );

			return {
				viewportW : getViewportW
			};
		}
	};



	//
	// Set of default animations
	//
	// /////////////////////////////////////////////////////////

	MK.ui.Slider.prototype.animation = {

        slide : {
        	axis : 'X',
            next : { transform: {} },
            active : { transform: {} },
            prev : { transform: {} }
        },

        vertical_slide : {
        	axis : 'Y',
            next : { transform: {} },
            active : { transform: {} },
            prev : { transform: {} }
        },

        perspective_flip : {
        	axis : 'Y',
            next : {
            	transform: {
            		rotateX : 80
            	}
            },
            active : {
            	transform: {
            		rotateX : 0
            	}
            },
            prev : {
            	transform: {
            		rotateX : 0
            	}
            }
        },

        zoom : {
			axis : 'Z',
            next: {
                opacity	: 0,
                transform : {
	                scale : 0.9
	            }
            },
            active: {
                opacity	: 1,
                transform : {
	                scale : 1
	            }
            },
            prev: {
                opacity	: 0,
                transform : {
	                scale : 1.1
	            }
            }
        },

        fade : {
			axis : 'Z',
            next: {
                opacity	: 0,
                transform : {}
            },
            active: {
                opacity	: 1,
                transform : {}
            },
            prev: {
                opacity	: 0,
                transform : {}
            }
        },

        kenburned : {
			axis : 'Z',
            next: {
                opacity	: 0,
                transform : {}
            },
            active: {
                opacity	: 1,
                transform : {}
            },
            prev: {
                opacity	: 0,
                transform : {}
            }
        },

        zoom_out : {
			axis : 'Z',
            next: {
				zIndex : '+',
                opacity	: 1,
                transform : {
	                translateY : 100,
	                scale : 1
	            }
            },
            active: {
                opacity	: 1,
                transform : {
	                translateY : 0,
	                scale : 1
	            }
            },
            prev: {
				zIndex : '+',
                opacity	: 0,
                transform : {
	                translateY : 0,
	                scale : 0.5
	            }
            }
        },

        // Problem with Z-Flow
        horizontal_curtain : {
			axis : 'Z',
            next: {
				zIndex : '+',
                transform : {
	                translateX : 100,
	            }
            },
            active: {
                transform : {
	                translateX : 0,
	            }
            },
            prev: {
				zIndex : '+',
                transform : {
	                translateX : -70,
	            }
            }
        },

		roulete : {
			axis : 'X',
            next: {
                opacity	: 0.5,
                transform : {
	                scale : 0.5,
	                rotate : 10,
	                translateY : 20
	            }
            },
            active: {
                opacity	: 1,
                transform : {
	                scale : 1,
	                rotate : 0,
	                translateY : 0
	            }
            },
            prev: {
                opacity	: 0.3,
                transform : {
	                scale : 0.5,
	                rotate : -10,
	                translateY : 20
	            }
            }
		}
	};



	//
	// Penner's easing library
	//
	// /////////////////////////////////////////////////////////

	MK.ui.Slider.prototype.ease = {
		/*
		 *
		 * TERMS OF USE - EASING EQUATIONS
		 *
		 * Open source under the BSD License.
		 *
		 * Copyright Â© 2001 Robert Penner
		 * All rights reserved.
		 *
		 * Redistribution and use in source and binary forms, with or without modification,
		 * are permitted provided that the following conditions are met:
		 *
		 * Redistributions of source code must retain the above copyright notice, this list of
		 * conditions and the following disclaimer.
		 * Redistributions in binary form must reproduce the above copyright notice, this list
		 * of conditions and the following disclaimer in the documentation and/or other materials
		 * provided with the distribution.
		 *
		 * Neither the name of the author nor the names of contributors may be used to endorse
		 * or promote products derived from this software without specific prior written permission.
		 *
		 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
		 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
		 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
		 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
		 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
		 * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
		 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
		 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
		 * OF THE POSSIBILITY OF SUCH DAMAGE.
		 *
		 */
		linearEase : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * currentIteration / totalIterations + startValue;
		},

		easeInQuad : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (currentIteration /= totalIterations) * currentIteration + startValue;
		},

		easeOutQuad : function(currentIteration, startValue, changeInValue, totalIterations) {
			return -changeInValue * (currentIteration /= totalIterations) * (currentIteration - 2) + startValue;
		},

		easeInOutQuad : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * currentIteration * currentIteration + startValue;
			}
			return -changeInValue / 2 * ((--currentIteration) * (currentIteration - 2) - 1) + startValue;
		},

		easeInCubic : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow(currentIteration / totalIterations, 3) + startValue;
		},

		easeOutCubic : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (Math.pow(currentIteration / totalIterations - 1, 3) + 1) + startValue;
		},

		easeInOutCubic : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(currentIteration, 3) + startValue;
			}
			return changeInValue / 2 * (Math.pow(currentIteration - 2, 3) + 2) + startValue;
		},

		easeInQuart : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow (currentIteration / totalIterations, 4) + startValue;
		},

		easeOutQuart : function(currentIteration, startValue, changeInValue, totalIterations) {
			return -changeInValue * (Math.pow(currentIteration / totalIterations - 1, 4) - 1) + startValue;
		},

		easeInOutQuart : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(currentIteration, 4) + startValue;
			}
			return -changeInValue/2 * (Math.pow(currentIteration - 2, 4) - 2) + startValue;
		},

		easeInQuint : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow (currentIteration / totalIterations, 5) + startValue;
		},

		easeOutQuint : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (Math.pow(currentIteration / totalIterations - 1, 5) + 1) + startValue;
		},

		easeInOutQuint : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(currentIteration, 5) + startValue;
			}
			return changeInValue / 2 * (Math.pow(currentIteration - 2, 5) + 2) + startValue;
		},

		easeInSine : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (1 - Math.cos(currentIteration / totalIterations * (Math.PI / 2))) + startValue;
		},

		easeOutSine : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.sin(currentIteration / totalIterations * (Math.PI / 2)) + startValue;
		},

		easeInOutSine : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue / 2 * (1 - Math.cos(Math.PI * currentIteration / totalIterations)) + startValue;
		},

		easeInExpo : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.pow(2, 10 * (currentIteration / totalIterations - 1)) + startValue;
		},

		easeOutExpo : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (-Math.pow(2, -10 * currentIteration / totalIterations) + 1) + startValue;
		},

		easeInOutExpo : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * Math.pow(2, 10 * (currentIteration - 1)) + startValue;
			}
			return changeInValue / 2 * (-Math.pow(2, -10 * --currentIteration) + 2) + startValue;
		},

		easeInCirc : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * (1 - Math.sqrt(1 - (currentIteration /= totalIterations) * currentIteration)) + startValue;
		},

		easeOutCirc : function(currentIteration, startValue, changeInValue, totalIterations) {
			return changeInValue * Math.sqrt(1 - (currentIteration = currentIteration / totalIterations - 1) * currentIteration) + startValue;
		},

		easeInOutCirc : function(currentIteration, startValue, changeInValue, totalIterations) {
			if ((currentIteration /= totalIterations / 2) < 1) {
				return changeInValue / 2 * (1 - Math.sqrt(1 - currentIteration * currentIteration)) + startValue;
			}
			return changeInValue / 2 * (Math.sqrt(1 - (currentIteration -= 2) * currentIteration) + 1) + startValue;
		}
	};

})(jQuery);

(function($) {
	'use strict';
  var MK = window.MK || {};
  window.MK = MK;
  MK.ui = window.MK.ui || {};

	MK.component.Sortable = function(el) {
		this.el = el;
	};

	MK.component.Sortable.prototype = {
		init: function init() {
			this.cacheElements();
			this.bindEvents();
		},

		cacheElements: function cacheElements() {
			this.unique = Date.now();
			this.$filter = $(this.el);
			this.config = this.$filter.data('sortable-config');

			this.ajaxLoader = new MK.utils.ajaxLoader(this.config.container);
			this.ajaxLoader.init();

			this.$container = $( this.config.container );
			this.$navItems = this.$filter.find('a');
			this.$filterItems = this.$container.find(this.config.item);
		},

		bindEvents: function bindEvents() {
			this.$navItems.on('click', this.handleClick.bind(this));
			MK.utils.eventManager.subscribe('ajaxLoaded', this.onLoad.bind(this));
		},

		handleClick: function handleClick(e) {
			e.preventDefault();

			var $item = $(e.currentTarget);
			var term = $item.data('filter');

			this.$navItems.removeClass('current');
			$item.addClass('current');

			if(this.config.mode === 'ajax') this.inDB(term, $item);
	        else this.inPage(term);
		},

		inDB: function inDB(term, $item) {
			// Add load indicator only for long requests
			MK.ui.loader.remove(this.$filter);
			MK.ui.loader.add($item);

			// If mk-ajax-loaded-posts span exists and one of the filter is clicked,
			// clear post ids
			if ( this.$container.siblings('.mk-ajax-loaded-posts').length ) {
				this.$container.siblings('.mk-ajax-loaded-posts').attr('data-loop-loaded-posts', '');
			}

			this.ajaxLoader.setData({
				paged: 1,
				term: term
			});
            this.ajaxLoader.load(this.unique);
		},

		inPage: function inPage(term) {
			var $filterItems = this.$container.find(this.config.item);
			$filterItems.removeClass('is-hidden'); // show all first
			// Replace all ', ' with ', .'. It's used to add '.' as class selector of each category.
			var className = term.replace( /, /g, ", ." );
			if(term !== '*') $filterItems.not( '.' + className ).addClass('is-hidden'); // hide filtered
			MK.utils.eventManager.publish('staticFilter');
		},

		onLoad: function onLoad(e, response) {
			if(this.config.mode === 'static') {
				this.$navItems.removeClass('current').first().addClass('current');
			}
			if( typeof response !== 'undefined' &&  response.id === this.config.container) {
				MK.ui.loader.remove(this.$filter);
				if(response.unique === this.unique) {
		            this.$container.html(response.content);
					this.ajaxLoader.setData({paged: 1});
				}
			}
		}
	};

})(jQuery);

(function($) {
    'use strict';

    MK.component.Tabs = function( el ) {
        var defaults = {
            activeClass : 'is-active'
        };

        this.config = defaults;
        this.el = el;
    };

    MK.component.Tabs.prototype = {

        init : function() {
            this.cacheElements();
            this.bindEvents();
        },

        cacheElements : function() {
            this.$this  = $( this.el );
            this.$tabs  = this.$this.find( '.mk-tabs-tab' );
            this.$panes = this.$this.find( '.mk-tabs-pane' );
            this.currentId = 0;
        },

        bindEvents : function() {
            var self = this;

            this.$tabs.on( 'click', this.switchPane.bind( this ) );
        },

        switchPane : function( evt ) {
            evt.preventDefault();

            var clickedId = $( evt.currentTarget ).index();

            this.hide( this.currentId );
            this.show( clickedId );

            // Update current id
            this.currentId = clickedId;

            // Notify rest of the app
            MK.utils.eventManager.publish('item-expanded');            
        },

        show : function( id ) {
            this.$tabs.eq( id ).addClass( this.config.activeClass );
            this.$panes.eq( id ).addClass( this.config.activeClass );
        },

        hide : function( id ) {
            this.$tabs.eq( id ).removeClass( this.config.activeClass );
            this.$panes.eq( id ).removeClass( this.config.activeClass );
        }
    };

})(jQuery);


/* Tabs */
/* -------------------------------------------------------------------- */

function mk_tabs() {

  // "use strict";

  // if ($.exists('.mk-tabs, .mk-news-tab, .mk-woo-tabs')) {
  //   $(".mk-tabs, .mk-news-tab, .mk-woo-tabs").tabs();

  //    $('.mk-tabs').on('click', function () {
  //      $('.mk-theme-loop').isotope('layout');
  //    });

  //   $('.mk-tabs.vertical-style').each(function () {
  //     $(this).find('.mk-tabs-pane').css('minHeight', $(this).find('.mk-tabs-tabs').height() - 1);
  //   });

  // }
}

function mk_tabs_responsive(){
  // $('.mk-tabs, .mk-news-tab').each(function () {
  //   $this = $(this);
  //   if ($this.hasClass('mobile-true')) {
  //     if (window.matchMedia('(max-width: 767px)').matches)
  //     {
  //         $this.tabs("destroy");
  //     } else {
  //       $this.tabs();
  //     }
  //   }
  // });
  
}


(function($) {
  'use strict';

  $(document).on('click', function(e) {
    $('.mk-toggle-trigger').removeClass('mk-toggle-active');
  });

  function toggle(e) {
      e.preventDefault();
      e.stopPropagation();
      var $this = $(e.currentTarget);

      if (!$this.hasClass('mk-toggle-active')) {

        $('.mk-box-to-trigger').fadeOut(200);
        $this.parent().find('.mk-box-to-trigger').fadeIn(250);
        $('.mk-toggle-trigger').removeClass('mk-toggle-active');
        $this.addClass('mk-toggle-active');

      } else {

        $('.mk-box-to-trigger').fadeOut(200);
        $this.removeClass('mk-toggle-active');

      }
  }

  function assignToggle() {
    // wait for ajax response propagation and insertion
    setTimeout(function() {
      $('.mk-toggle-trigger').off('click', toggle);
      $('.mk-toggle-trigger').on('click', toggle);
    }, 100);
  }

  assignToggle();
  MK.utils.eventManager.subscribe('ajaxLoaded', assignToggle);
  MK.utils.eventManager.subscribe('ajax-preview', assignToggle);

  $(window).on('vc_reload', function(){
    assignToggle();
    MK.utils.eventManager.subscribe('ajaxLoaded', assignToggle);
    MK.utils.eventManager.subscribe('ajax-preview', assignToggle);
  });

}(jQuery));
(function($) {
    'use strict';

    var init = function init() {
        var Toggle = function(el) {
        var that = this,
            $el = $(el);

            this.$el = $el;
            $el.on('click', function() {
              $el.hasClass('active-toggle') ? that.close() : that.open()
            });
        };

        Toggle.prototype.dom = {
            pane   : 'mk-toggle-pane',
            active : 'active-toggle'
        };

        Toggle.prototype.open = function() {
            var $this = this.$el;
            $this.addClass(this.dom.active);
            $this.siblings('.' + this.dom.pane).slideDown(200);
        };

        Toggle.prototype.close = function() {
            var $this = this.$el;
            $this.removeClass(this.dom.active);
            $this.siblings('.' + this.dom.pane).slideUp(200);
        };

        // Apply to.
        var $toggle = $('.mk-toggle-title');

        if(!$toggle.length) return;

        $toggle.each(function() {
            new Toggle(this);
        });
    }
    $(window).on('load vc_reload', init);

})(jQuery);

/**
 * Add class to tag. It's vanilla js instead of jQuery.
 * @param tag
 * @param className
 */
function addClass(tag, className) {
  tag.className += ' ' + className;
}

/**
* Remove class from tag. It's vanilla js instead of jQuery.
* Replacing should be with g for replacing all occurrence.
*
* @param tag
* @param className
*/
function removeClass(tag, className) {
  tag.className = tag.className.replace(new RegExp(className, 'g'), '');
}

/**
 * Validate email address.
 *
 * @param input
 * @param invalidClassName
 * @returns boolean
 */
function validateEmail(input, invalidClassName) {
    var value = input.value.trim();
    if ((input.required || value.length > 0) && !/^([a-z0-9_\.\-\+]+)@([\da-z\.\-]+)\.([a-z\.]{2,63})$/i.test(value)) {
        if (invalidClassName) {
            addClass(input, invalidClassName);
        }
        return false;
    } else {
        if (invalidClassName) {
            removeClass(input, invalidClassName);
        }
        return true;
    }
}
/**
 * Validate text entry.
 *
 * @param input
 * @param invalidClassName
 * @returns boolean
 */
function validateText(input, invalidClassName) {
    var value = input.value.trim();
    if (input.required && value.length === 0) {
        if (invalidClassName) {
            addClass(input, invalidClassName);
        }
        return false;
    } else {
        if (invalidClassName) {
            removeClass(input, invalidClassName);
        }
        return true;
    }
}
/**
 * Validate Checkbox.
 *
 * @param input
 * @param invalidClassName
 * @returns boolean
 */
function validateCheckBox(input, invalidClassName) {
    if (input.required && input.checked == false) {
        if (invalidClassName) {
            addClass(input, invalidClassName);
        }
        return false;
    } else {
        if (invalidClassName) {
            removeClass(input, invalidClassName);
        }
        return true;
    }
}
/**
 * If we're running under Node for testing purpose.
 */
if (typeof exports !== 'undefined') {
    exports.validateEmail = validateEmail;
    exports.validateText = validateText;
}
(function( $ ) {
    'use strict';

    if( MK.utils.isMobile() ) {
        $('.mk-animate-element').removeClass('mk-animate-element');
        return;
    }


    var init = function init() {
      var $rootLevelEls = $('.js-master-row, .widget');
        $rootLevelEls.each( spyViewport );
        $rootLevelEls.each( function rootLevelEl() {
            var $animateEl = $(this).find( '.mk-animate-element' );
            $animateEl.each( spyViewport );

            /**
             * Firefox has known issue where horizontal scrollbar will appear if an
             * element uses animation CSS. The solution should be set the element
             * position as fixed or overflow-x as hidden. Position fixed is not possible
             * to use because it's only cause other big problems. The best way is
             * set overflow-x as hidden in the page content container #theme-page.
             *
             * NOTE: The problem is spotted on Right To Left viewport only. So, it's
             *       limited to '.right-to-left' selector only for now to avoid other
             *       problems. Please extend the functionallity if it's happen in
             *       other viewport animation effect.
             */
            var browserName  = MK.utils.browser.name;
            if ( browserName === 'Firefox' ) {
                var $rightToLeft = $( this ).find( '.right-to-left' );
                if ( $rightToLeft.length > 0 ) {
                    $( '#theme-page' ).css( 'overflow-x', 'hidden' );
                }
            }
        });
    };

    var spyViewport = function spyViewport(i) {
        var self = this;

        MK.utils.scrollSpy( this, {
            position  : 'bottom',
            threshold : 200,
            after     : function() {
                animate.call(self, i);
            }
        });
    };

    var animate = function animate(i) {
        var $this = $(this);

        setTimeout(function() {
            $this.addClass( 'mk-in-viewport' );
        }, 100 * i);
    };


    $(window).on('load vc_reload', init);

}(jQuery));
