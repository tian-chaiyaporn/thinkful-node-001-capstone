(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],2:[function(require,module,exports){
(function (process){
  /* globals require, module */

  'use strict';

  /**
   * Module dependencies.
   */

  var pathtoRegexp = require('path-to-regexp');

  /**
   * Module exports.
   */

  module.exports = page;

  /**
   * Detect click event
   */
  var clickEvent = ('undefined' !== typeof document) && document.ontouchstart ? 'touchstart' : 'click';

  /**
   * To work properly with the URL
   * history.location generated polyfill in https://github.com/devote/HTML5-History-API
   */

  var location = ('undefined' !== typeof window) && (window.history.location || window.location);

  /**
   * Perform initial dispatch.
   */

  var dispatch = true;


  /**
   * Decode URL components (query string, pathname, hash).
   * Accommodates both regular percent encoding and x-www-form-urlencoded format.
   */
  var decodeURLComponents = true;

  /**
   * Base path.
   */

  var base = '';

  /**
   * Running flag.
   */

  var running;

  /**
   * HashBang option
   */

  var hashbang = false;

  /**
   * Previous context, for capturing
   * page exit events.
   */

  var prevContext;

  /**
   * Register `path` with callback `fn()`,
   * or route `path`, or redirection,
   * or `page.start()`.
   *
   *   page(fn);
   *   page('*', fn);
   *   page('/user/:id', load, user);
   *   page('/user/' + user.id, { some: 'thing' });
   *   page('/user/' + user.id);
   *   page('/from', '/to')
   *   page();
   *
   * @param {string|!Function|!Object} path
   * @param {Function=} fn
   * @api public
   */

  function page(path, fn) {
    // <callback>
    if ('function' === typeof path) {
      return page('*', path);
    }

    // route <path> to <callback ...>
    if ('function' === typeof fn) {
      var route = new Route(/** @type {string} */ (path));
      for (var i = 1; i < arguments.length; ++i) {
        page.callbacks.push(route.middleware(arguments[i]));
      }
      // show <path> with [state]
    } else if ('string' === typeof path) {
      page['string' === typeof fn ? 'redirect' : 'show'](path, fn);
      // start [options]
    } else {
      page.start(path);
    }
  }

  /**
   * Callback functions.
   */

  page.callbacks = [];
  page.exits = [];

  /**
   * Current path being processed
   * @type {string}
   */
  page.current = '';

  /**
   * Number of pages navigated to.
   * @type {number}
   *
   *     page.len == 0;
   *     page('/login');
   *     page.len == 1;
   */

  page.len = 0;

  /**
   * Get or set basepath to `path`.
   *
   * @param {string} path
   * @api public
   */

  page.base = function(path) {
    if (0 === arguments.length) return base;
    base = path;
  };

  /**
   * Bind with the given `options`.
   *
   * Options:
   *
   *    - `click` bind to click events [true]
   *    - `popstate` bind to popstate [true]
   *    - `dispatch` perform initial dispatch [true]
   *
   * @param {Object} options
   * @api public
   */

  page.start = function(options) {
    options = options || {};
    if (running) return;
    running = true;
    if (false === options.dispatch) dispatch = false;
    if (false === options.decodeURLComponents) decodeURLComponents = false;
    if (false !== options.popstate) window.addEventListener('popstate', onpopstate, false);
    if (false !== options.click) {
      document.addEventListener(clickEvent, onclick, false);
    }
    if (true === options.hashbang) hashbang = true;
    if (!dispatch) return;
    var url = (hashbang && ~location.hash.indexOf('#!')) ? location.hash.substr(2) + location.search : location.pathname + location.search + location.hash;
    page.replace(url, null, true, dispatch);
  };

  /**
   * Unbind click and popstate event handlers.
   *
   * @api public
   */

  page.stop = function() {
    if (!running) return;
    page.current = '';
    page.len = 0;
    running = false;
    document.removeEventListener(clickEvent, onclick, false);
    window.removeEventListener('popstate', onpopstate, false);
  };

  /**
   * Show `path` with optional `state` object.
   *
   * @param {string} path
   * @param {Object=} state
   * @param {boolean=} dispatch
   * @param {boolean=} push
   * @return {!Context}
   * @api public
   */

  page.show = function(path, state, dispatch, push) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    if (false !== dispatch) page.dispatch(ctx);
    if (false !== ctx.handled && false !== push) ctx.pushState();
    return ctx;
  };

  /**
   * Goes back in the history
   * Back should always let the current route push state and then go back.
   *
   * @param {string} path - fallback path to go back if no more history exists, if undefined defaults to page.base
   * @param {Object=} state
   * @api public
   */

  page.back = function(path, state) {
    if (page.len > 0) {
      // this may need more testing to see if all browsers
      // wait for the next tick to go back in history
      history.back();
      page.len--;
    } else if (path) {
      setTimeout(function() {
        page.show(path, state);
      });
    }else{
      setTimeout(function() {
        page.show(base, state);
      });
    }
  };


  /**
   * Register route to redirect from one path to other
   * or just redirect to another route
   *
   * @param {string} from - if param 'to' is undefined redirects to 'from'
   * @param {string=} to
   * @api public
   */
  page.redirect = function(from, to) {
    // Define route from a path to another
    if ('string' === typeof from && 'string' === typeof to) {
      page(from, function(e) {
        setTimeout(function() {
          page.replace(/** @type {!string} */ (to));
        }, 0);
      });
    }

    // Wait for the push state and replace it with another
    if ('string' === typeof from && 'undefined' === typeof to) {
      setTimeout(function() {
        page.replace(from);
      }, 0);
    }
  };

  /**
   * Replace `path` with optional `state` object.
   *
   * @param {string} path
   * @param {Object=} state
   * @param {boolean=} init
   * @param {boolean=} dispatch
   * @return {!Context}
   * @api public
   */


  page.replace = function(path, state, init, dispatch) {
    var ctx = new Context(path, state);
    page.current = ctx.path;
    ctx.init = init;
    ctx.save(); // save before dispatching, which may redirect
    if (false !== dispatch) page.dispatch(ctx);
    return ctx;
  };

  /**
   * Dispatch the given `ctx`.
   *
   * @param {Context} ctx
   * @api private
   */
  page.dispatch = function(ctx) {
    var prev = prevContext,
      i = 0,
      j = 0;

    prevContext = ctx;

    function nextExit() {
      var fn = page.exits[j++];
      if (!fn) return nextEnter();
      fn(prev, nextExit);
    }

    function nextEnter() {
      var fn = page.callbacks[i++];

      if (ctx.path !== page.current) {
        ctx.handled = false;
        return;
      }
      if (!fn) return unhandled(ctx);
      fn(ctx, nextEnter);
    }

    if (prev) {
      nextExit();
    } else {
      nextEnter();
    }
  };

  /**
   * Unhandled `ctx`. When it's not the initial
   * popstate then redirect. If you wish to handle
   * 404s on your own use `page('*', callback)`.
   *
   * @param {Context} ctx
   * @api private
   */
  function unhandled(ctx) {
    if (ctx.handled) return;
    var current;

    if (hashbang) {
      current = base + location.hash.replace('#!', '');
    } else {
      current = location.pathname + location.search;
    }

    if (current === ctx.canonicalPath) return;
    page.stop();
    ctx.handled = false;
    location.href = ctx.canonicalPath;
  }

  /**
   * Register an exit route on `path` with
   * callback `fn()`, which will be called
   * on the previous context when a new
   * page is visited.
   */
  page.exit = function(path, fn) {
    if (typeof path === 'function') {
      return page.exit('*', path);
    }

    var route = new Route(path);
    for (var i = 1; i < arguments.length; ++i) {
      page.exits.push(route.middleware(arguments[i]));
    }
  };

  /**
   * Remove URL encoding from the given `str`.
   * Accommodates whitespace in both x-www-form-urlencoded
   * and regular percent-encoded form.
   *
   * @param {string} val - URL component to decode
   */
  function decodeURLEncodedURIComponent(val) {
    if (typeof val !== 'string') { return val; }
    return decodeURLComponents ? decodeURIComponent(val.replace(/\+/g, ' ')) : val;
  }

  /**
   * Initialize a new "request" `Context`
   * with the given `path` and optional initial `state`.
   *
   * @constructor
   * @param {string} path
   * @param {Object=} state
   * @api public
   */

  function Context(path, state) {
    if ('/' === path[0] && 0 !== path.indexOf(base)) path = base + (hashbang ? '#!' : '') + path;
    var i = path.indexOf('?');

    this.canonicalPath = path;
    this.path = path.replace(base, '') || '/';
    if (hashbang) this.path = this.path.replace('#!', '') || '/';

    this.title = document.title;
    this.state = state || {};
    this.state.path = path;
    this.querystring = ~i ? decodeURLEncodedURIComponent(path.slice(i + 1)) : '';
    this.pathname = decodeURLEncodedURIComponent(~i ? path.slice(0, i) : path);
    this.params = {};

    // fragment
    this.hash = '';
    if (!hashbang) {
      if (!~this.path.indexOf('#')) return;
      var parts = this.path.split('#');
      this.path = parts[0];
      this.hash = decodeURLEncodedURIComponent(parts[1]) || '';
      this.querystring = this.querystring.split('#')[0];
    }
  }

  /**
   * Expose `Context`.
   */

  page.Context = Context;

  /**
   * Push state.
   *
   * @api private
   */

  Context.prototype.pushState = function() {
    page.len++;
    history.pushState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Save the context state.
   *
   * @api public
   */

  Context.prototype.save = function() {
    history.replaceState(this.state, this.title, hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
  };

  /**
   * Initialize `Route` with the given HTTP `path`,
   * and an array of `callbacks` and `options`.
   *
   * Options:
   *
   *   - `sensitive`    enable case-sensitive routes
   *   - `strict`       enable strict matching for trailing slashes
   *
   * @constructor
   * @param {string} path
   * @param {Object=} options
   * @api private
   */

  function Route(path, options) {
    options = options || {};
    this.path = (path === '*') ? '(.*)' : path;
    this.method = 'GET';
    this.regexp = pathtoRegexp(this.path,
      this.keys = [],
      options);
  }

  /**
   * Expose `Route`.
   */

  page.Route = Route;

  /**
   * Return route middleware with
   * the given callback `fn()`.
   *
   * @param {Function} fn
   * @return {Function}
   * @api public
   */

  Route.prototype.middleware = function(fn) {
    var self = this;
    return function(ctx, next) {
      if (self.match(ctx.path, ctx.params)) return fn(ctx, next);
      next();
    };
  };

  /**
   * Check if this route matches `path`, if so
   * populate `params`.
   *
   * @param {string} path
   * @param {Object} params
   * @return {boolean}
   * @api private
   */

  Route.prototype.match = function(path, params) {
    var keys = this.keys,
      qsIndex = path.indexOf('?'),
      pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
      m = this.regexp.exec(decodeURIComponent(pathname));

    if (!m) return false;

    for (var i = 1, len = m.length; i < len; ++i) {
      var key = keys[i - 1];
      var val = decodeURLEncodedURIComponent(m[i]);
      if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
        params[key.name] = val;
      }
    }

    return true;
  };


  /**
   * Handle "populate" events.
   */

  var onpopstate = (function () {
    var loaded = false;
    if ('undefined' === typeof window) {
      return;
    }
    if (document.readyState === 'complete') {
      loaded = true;
    } else {
      window.addEventListener('load', function() {
        setTimeout(function() {
          loaded = true;
        }, 0);
      });
    }
    return function onpopstate(e) {
      if (!loaded) return;
      if (e.state) {
        var path = e.state.path;
        page.replace(path, e.state);
      } else {
        page.show(location.pathname + location.hash, undefined, undefined, false);
      }
    };
  })();
  /**
   * Handle "click" events.
   */

  function onclick(e) {

    if (1 !== which(e)) return;

    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (e.defaultPrevented) return;



    // ensure link
    // use shadow dom when available
    var el = e.path ? e.path[0] : e.target;
    while (el && 'A' !== el.nodeName) el = el.parentNode;
    if (!el || 'A' !== el.nodeName) return;



    // Ignore if tag has
    // 1. "download" attribute
    // 2. rel="external" attribute
    if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;

    // ensure non-hash for the same path
    var link = el.getAttribute('href');
    if (!hashbang && el.pathname === location.pathname && (el.hash || '#' === link)) return;



    // Check for mailto: in the href
    if (link && link.indexOf('mailto:') > -1) return;

    // check target
    if (el.target) return;

    // x-origin
    if (!sameOrigin(el.href)) return;



    // rebuild path
    var path = el.pathname + el.search + (el.hash || '');

    // strip leading "/[drive letter]:" on NW.js on Windows
    if (typeof process !== 'undefined' && path.match(/^\/[a-zA-Z]:\//)) {
      path = path.replace(/^\/[a-zA-Z]:\//, '/');
    }

    // same page
    var orig = path;

    if (path.indexOf(base) === 0) {
      path = path.substr(base.length);
    }

    if (hashbang) path = path.replace('#!', '');

    if (base && orig === path) return;

    e.preventDefault();
    page.show(orig);
  }

  /**
   * Event button.
   */

  function which(e) {
    e = e || window.event;
    return null === e.which ? e.button : e.which;
  }

  /**
   * Check if `href` is the same origin.
   */

  function sameOrigin(href) {
    var origin = location.protocol + '//' + location.hostname;
    if (location.port) origin += ':' + location.port;
    return (href && (0 === href.indexOf(origin)));
  }

  page.sameOrigin = sameOrigin;

}).call(this,require('_process'))

},{"_process":4,"path-to-regexp":3}],3:[function(require,module,exports){
var isarray = require('isarray')

/**
 * Expose `pathToRegexp`.
 */
module.exports = pathToRegexp
module.exports.parse = parse
module.exports.compile = compile
module.exports.tokensToFunction = tokensToFunction
module.exports.tokensToRegExp = tokensToRegExp

/**
 * The main path matching regexp utility.
 *
 * @type {RegExp}
 */
var PATH_REGEXP = new RegExp([
  // Match escaped characters that would otherwise appear in future matches.
  // This allows the user to escape special characters that won't transform.
  '(\\\\.)',
  // Match Express-style parameters and un-named parameters with a prefix
  // and optional suffixes. Matches appear as:
  //
  // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
  // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
  // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
  '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'
].join('|'), 'g')

/**
 * Parse a string for the raw tokens.
 *
 * @param  {String} str
 * @return {Array}
 */
function parse (str) {
  var tokens = []
  var key = 0
  var index = 0
  var path = ''
  var res

  while ((res = PATH_REGEXP.exec(str)) != null) {
    var m = res[0]
    var escaped = res[1]
    var offset = res.index
    path += str.slice(index, offset)
    index = offset + m.length

    // Ignore already escaped sequences.
    if (escaped) {
      path += escaped[1]
      continue
    }

    // Push the current path onto the tokens.
    if (path) {
      tokens.push(path)
      path = ''
    }

    var prefix = res[2]
    var name = res[3]
    var capture = res[4]
    var group = res[5]
    var suffix = res[6]
    var asterisk = res[7]

    var repeat = suffix === '+' || suffix === '*'
    var optional = suffix === '?' || suffix === '*'
    var delimiter = prefix || '/'
    var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?')

    tokens.push({
      name: name || key++,
      prefix: prefix || '',
      delimiter: delimiter,
      optional: optional,
      repeat: repeat,
      pattern: escapeGroup(pattern)
    })
  }

  // Match any characters still remaining.
  if (index < str.length) {
    path += str.substr(index)
  }

  // If the path exists, push it onto the end.
  if (path) {
    tokens.push(path)
  }

  return tokens
}

/**
 * Compile a string to a template function for the path.
 *
 * @param  {String}   str
 * @return {Function}
 */
function compile (str) {
  return tokensToFunction(parse(str))
}

/**
 * Expose a method for transforming tokens into the path function.
 */
function tokensToFunction (tokens) {
  // Compile all the tokens into regexps.
  var matches = new Array(tokens.length)

  // Compile all the patterns before compilation.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] === 'object') {
      matches[i] = new RegExp('^' + tokens[i].pattern + '$')
    }
  }

  return function (obj) {
    var path = ''
    var data = obj || {}

    for (var i = 0; i < tokens.length; i++) {
      var token = tokens[i]

      if (typeof token === 'string') {
        path += token

        continue
      }

      var value = data[token.name]
      var segment

      if (value == null) {
        if (token.optional) {
          continue
        } else {
          throw new TypeError('Expected "' + token.name + '" to be defined')
        }
      }

      if (isarray(value)) {
        if (!token.repeat) {
          throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
        }

        if (value.length === 0) {
          if (token.optional) {
            continue
          } else {
            throw new TypeError('Expected "' + token.name + '" to not be empty')
          }
        }

        for (var j = 0; j < value.length; j++) {
          segment = encodeURIComponent(value[j])

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
          }

          path += (j === 0 ? token.prefix : token.delimiter) + segment
        }

        continue
      }

      segment = encodeURIComponent(value)

      if (!matches[i].test(segment)) {
        throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
      }

      path += token.prefix + segment
    }

    return path
  }
}

/**
 * Escape a regular expression string.
 *
 * @param  {String} str
 * @return {String}
 */
function escapeString (str) {
  return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
}

/**
 * Escape the capturing group by escaping special characters and meaning.
 *
 * @param  {String} group
 * @return {String}
 */
function escapeGroup (group) {
  return group.replace(/([=!:$\/()])/g, '\\$1')
}

/**
 * Attach the keys as a property of the regexp.
 *
 * @param  {RegExp} re
 * @param  {Array}  keys
 * @return {RegExp}
 */
function attachKeys (re, keys) {
  re.keys = keys
  return re
}

/**
 * Get the flags for a regexp from the options.
 *
 * @param  {Object} options
 * @return {String}
 */
function flags (options) {
  return options.sensitive ? '' : 'i'
}

/**
 * Pull out keys from a regexp.
 *
 * @param  {RegExp} path
 * @param  {Array}  keys
 * @return {RegExp}
 */
function regexpToRegexp (path, keys) {
  // Use a negative lookahead to match only capturing groups.
  var groups = path.source.match(/\((?!\?)/g)

  if (groups) {
    for (var i = 0; i < groups.length; i++) {
      keys.push({
        name: i,
        prefix: null,
        delimiter: null,
        optional: false,
        repeat: false,
        pattern: null
      })
    }
  }

  return attachKeys(path, keys)
}

/**
 * Transform an array into a regexp.
 *
 * @param  {Array}  path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function arrayToRegexp (path, keys, options) {
  var parts = []

  for (var i = 0; i < path.length; i++) {
    parts.push(pathToRegexp(path[i], keys, options).source)
  }

  var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options))

  return attachKeys(regexp, keys)
}

/**
 * Create a path regexp from string input.
 *
 * @param  {String} path
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function stringToRegexp (path, keys, options) {
  var tokens = parse(path)
  var re = tokensToRegExp(tokens, options)

  // Attach keys back to the regexp.
  for (var i = 0; i < tokens.length; i++) {
    if (typeof tokens[i] !== 'string') {
      keys.push(tokens[i])
    }
  }

  return attachKeys(re, keys)
}

/**
 * Expose a function for taking tokens and returning a RegExp.
 *
 * @param  {Array}  tokens
 * @param  {Array}  keys
 * @param  {Object} options
 * @return {RegExp}
 */
function tokensToRegExp (tokens, options) {
  options = options || {}

  var strict = options.strict
  var end = options.end !== false
  var route = ''
  var lastToken = tokens[tokens.length - 1]
  var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken)

  // Iterate over the tokens and create our regexp string.
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i]

    if (typeof token === 'string') {
      route += escapeString(token)
    } else {
      var prefix = escapeString(token.prefix)
      var capture = token.pattern

      if (token.repeat) {
        capture += '(?:' + prefix + capture + ')*'
      }

      if (token.optional) {
        if (prefix) {
          capture = '(?:' + prefix + '(' + capture + '))?'
        } else {
          capture = '(' + capture + ')?'
        }
      } else {
        capture = prefix + '(' + capture + ')'
      }

      route += capture
    }
  }

  // In non-strict mode we allow a slash at the end of match. If the path to
  // match already ends with a slash, we remove it for consistency. The slash
  // is valid at the end of a path match, not in the middle. This is important
  // in non-ending mode, where "/test/" shouldn't match "/test//route".
  if (!strict) {
    route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?'
  }

  if (end) {
    route += '$'
  } else {
    // In non-ending mode, we need the capturing groups to match as much as
    // possible by using a positive lookahead to the end or next path segment.
    route += strict && endsWithSlash ? '' : '(?=\\/|$)'
  }

  return new RegExp('^' + route, flags(options))
}

/**
 * Normalize the given path string, returning a regular expression.
 *
 * An empty array can be passed in for the keys, which will hold the
 * placeholder key descriptions. For example, using `/user/:id`, `keys` will
 * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
 *
 * @param  {(String|RegExp|Array)} path
 * @param  {Array}                 [keys]
 * @param  {Object}                [options]
 * @return {RegExp}
 */
function pathToRegexp (path, keys, options) {
  keys = keys || []

  if (!isarray(keys)) {
    options = keys
    keys = []
  } else if (!options) {
    options = {}
  }

  if (path instanceof RegExp) {
    return regexpToRegexp(path, keys, options)
  }

  if (isarray(path)) {
    return arrayToRegexp(path, keys, options)
  }

  return stringToRegexp(path, keys, options)
}

},{"isarray":1}],4:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],5:[function(require,module,exports){
/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
var byteToHex = [];
for (var i = 0; i < 256; ++i) {
  byteToHex[i] = (i + 0x100).toString(16).substr(1);
}

function bytesToUuid(buf, offset) {
  var i = offset || 0;
  var bth = byteToHex;
  return bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] + '-' +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]] +
          bth[buf[i++]] + bth[buf[i++]];
}

module.exports = bytesToUuid;

},{}],6:[function(require,module,exports){
(function (global){
// Unique ID creation requires a high quality random # generator.  In the
// browser this is a little complicated due to unknown quality of Math.random()
// and inconsistent support for the `crypto` API.  We do the best we can via
// feature-detection
var rng;

var crypto = global.crypto || global.msCrypto; // for IE 11
if (crypto && crypto.getRandomValues) {
  // WHATWG crypto RNG - http://wiki.whatwg.org/wiki/Crypto
  var rnds8 = new Uint8Array(16); // eslint-disable-line no-undef
  rng = function whatwgRNG() {
    crypto.getRandomValues(rnds8);
    return rnds8;
  };
}

if (!rng) {
  // Math.random()-based (RNG)
  //
  // If all else fails, use Math.random().  It's fast, but is of unspecified
  // quality.
  var rnds = new Array(16);
  rng = function() {
    for (var i = 0, r; i < 16; i++) {
      if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
      rnds[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return rnds;
  };
}

module.exports = rng;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],7:[function(require,module,exports){
var rng = require('./lib/rng');
var bytesToUuid = require('./lib/bytesToUuid');

function v4(options, buf, offset) {
  var i = buf && offset || 0;

  if (typeof(options) == 'string') {
    buf = options == 'binary' ? new Array(16) : null;
    options = null;
  }
  options = options || {};

  var rnds = options.random || (options.rng || rng)();

  // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
  rnds[6] = (rnds[6] & 0x0f) | 0x40;
  rnds[8] = (rnds[8] & 0x3f) | 0x80;

  // Copy bytes to buffer, if provided
  if (buf) {
    for (var ii = 0; ii < 16; ++ii) {
      buf[i + ii] = rnds[ii];
    }
  }

  return buf || bytesToUuid(rnds);
}

module.exports = v4;

},{"./lib/bytesToUuid":5,"./lib/rng":6}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _StringReplacer = require('./Utils/StringReplacer');

var _StringReplacer2 = _interopRequireDefault(_StringReplacer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// get template for each decision and display it
var createDecisionCard = function createDecisionCard(dice, component) {
  console.log('createDecisionCard was called');
  var map = {
    '@title': dice.decision,
    '@id': dice._id,
    '@description': 'to be determined'
  };
  var card = (0, _StringReplacer2.default)(component, map);
  $('.js-main-content').append(card);
  $('.js-roll').click(function (e) {
    e.stopImmediatePropagation();
    dice.roll().then(function (result) {
      return alert(result.content);
    });
  });
};

exports.default = { createDecisionCard: createDecisionCard };

},{"./Utils/StringReplacer":19}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _StringReplacer = require('./Utils/StringReplacer');

var _StringReplacer2 = _interopRequireDefault(_StringReplacer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var uuidv4 = require('uuid/v4');

var createDiceEditPage = function createDiceEditPage(dice, pageLayout, diceHeaderComponent, optionComponent) {
  console.log('createDiceEditPage was called');
  var diceMap = {
    '@title': dice.decision,
    '@description': 'to be determined'
  };
  var diceHeader = (0, _StringReplacer2.default)(diceHeaderComponent, diceMap);
  $('.js-main-content').append(pageLayout);
  $('.js-edit-decision-face').append(diceHeader);

  dice.options.forEach(function (option) {
    $('.js-edit-options-list').append((0, _StringReplacer2.default)(optionComponent, { '@option': option.content }));
    $('.js-delete-option').on("click", function (e) {
      e.stopImmediatePropagation();
      $(e.currentTarget).parent().remove();
      dice.deleteOption(option.face);

      console.log('option has been deleted');
      console.log(dice.options);
    });
  });

  $('.js-add-option').focus(function () {
    if (!$('.js-option-text').val().replace(/\s/g, '').length) {
      return;
    }
    var newId = uuidv4();
    var newOption = $('.js-option-text').val();

    $('.js-edit-options-list').append((0, _StringReplacer2.default)(optionComponent, { '@option': newOption }));

    $('.js-delete-option').on("click", function (e) {
      e.stopImmediatePropagation();
      $(e.currentTarget).parent().remove();
      dice.deleteOption(newId);
      console.log('option has been deleted');
      console.log(dice.options);
    });

    $('.js-option-text').val('');
    dice.addOption(newId, newOption);
    console.log(dice.options);
  });

  $('.js-save-dice').click(function () {
    return dice.save();
  });
  $('.js-delete-dice').click(function () {
    return dice.delete();
  });
};

exports.default = { createDiceEditPage: createDiceEditPage };

},{"./Utils/StringReplacer":19,"uuid/v4":7}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _DecisionListState = require('./Models/DecisionListState');

var _DecisionListState2 = _interopRequireDefault(_DecisionListState);

var _ComponentState = require('./Models/ComponentState');

var _ComponentState2 = _interopRequireDefault(_ComponentState);

var _DiceEditPageView = require('./DiceEditPageView');

var _DiceEditPageView2 = _interopRequireDefault(_DiceEditPageView);

var _constants = require('./Utils/constants');

var _StringReplacer = require('./Utils/StringReplacer');

var _StringReplacer2 = _interopRequireDefault(_StringReplacer);

var _ClearHTML = require('./Utils/ClearHTML');

var _ClearHTML2 = _interopRequireDefault(_ClearHTML);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// create the home page
// control fetching lists of decision dice and input as html
var diceEditView = function diceEditView(ctx) {
  var id = ctx.params.decisionId;
  console.log('id = ' + id);
  return Promise.all([_DecisionListState2.default.getDiceById(ctx.params.decisionId), _ComponentState2.default.getComponent('decision-edit-page'), _ComponentState2.default.getComponent('decision-edit-face'), _ComponentState2.default.getComponent('decision-edit-option')]).then(function (payload) {
    console.log(payload);
    if (!payload[0]) {
      console.log('there is no dice data');
      throw new Error('There is no data');
    } else {
      _ClearHTML2.default.clearHtml('js-main-content');
      _DiceEditPageView2.default.createDiceEditPage(payload[0], payload[1], payload[2], payload[3]);
    }
  });
};

// export default DiceView
exports.default = { diceEditView: diceEditView };

},{"./DiceEditPageView":9,"./Models/ComponentState":14,"./Models/DecisionListState":15,"./Utils/ClearHTML":17,"./Utils/StringReplacer":19,"./Utils/constants":20}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _StringReplacer = require('./Utils/StringReplacer');

var _StringReplacer2 = _interopRequireDefault(_StringReplacer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var createDicePage = function createDicePage(dice, pageLayout, diceComponent, optionComponent) {
  console.log('createDicePage was called');
  var diceMap = {
    '@title': dice.decision,
    '@description': 'to be determined',
    '@id': dice._id
  };
  var pageMap = {
    '@id': dice._id
  };
  var diceFace = (0, _StringReplacer2.default)(diceComponent, diceMap);
  var page = (0, _StringReplacer2.default)(pageLayout, pageMap);
  $('.js-main-content').append(page);
  $('.js-decision-face').append(diceFace);
  $('.js-roll').click(function (e) {
    e.stopImmediatePropagation();
    dice.roll().then(function (result) {
      return alert(result.content);
    });
  });

  dice.options.forEach(function (option) {
    $('.js-options-list').append((0, _StringReplacer2.default)(optionComponent, { '@option': option.content }));
  });
};

exports.default = { createDicePage: createDicePage };

},{"./Utils/StringReplacer":19}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _DecisionListState = require('./Models/DecisionListState');

var _DecisionListState2 = _interopRequireDefault(_DecisionListState);

var _ComponentState = require('./Models/ComponentState');

var _ComponentState2 = _interopRequireDefault(_ComponentState);

var _DicePageView = require('./DicePageView');

var _DicePageView2 = _interopRequireDefault(_DicePageView);

var _constants = require('./Utils/constants');

var _StringReplacer = require('./Utils/StringReplacer');

var _StringReplacer2 = _interopRequireDefault(_StringReplacer);

var _ClearHTML = require('./Utils/ClearHTML');

var _ClearHTML2 = _interopRequireDefault(_ClearHTML);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// create the home page
// control fetching lists of decision dice and input as html
var diceView = function diceView(ctx) {
  var id = ctx.params.decisionId;
  console.log('id = ' + id);
  return Promise.all([_DecisionListState2.default.getDiceById(ctx.params.decisionId), _ComponentState2.default.getComponent('decision-page'), _ComponentState2.default.getComponent('decision-face'), _ComponentState2.default.getComponent('decision-option')]).then(function (payload) {
    if (!payload[0]) {
      console.log('there is no dice data');
      throw new Error('There is no data');
    } else {
      _ClearHTML2.default.clearHtml('js-main-content');
      _DicePageView2.default.createDicePage(payload[0], payload[1], payload[2], payload[3]);
    }
  });
};

// export default DiceView
exports.default = { diceView: diceView };

},{"./DicePageView":11,"./Models/ComponentState":14,"./Models/DecisionListState":15,"./Utils/ClearHTML":17,"./Utils/StringReplacer":19,"./Utils/constants":20}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _DecisionListState = require('./Models/DecisionListState');

var _DecisionListState2 = _interopRequireDefault(_DecisionListState);

var _ComponentState = require('./Models/ComponentState');

var _ComponentState2 = _interopRequireDefault(_ComponentState);

var _DecisionCardView = require('./DecisionCardView');

var _DecisionCardView2 = _interopRequireDefault(_DecisionCardView);

var _ClearHTML = require('./Utils/ClearHTML');

var _ClearHTML2 = _interopRequireDefault(_ClearHTML);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// create the home page
// control fetching lists of decision dice and input as html
var viewHome = function viewHome() {
  console.log('viewHome starting 123');

  return Promise.all([_DecisionListState2.default.getDice(), _ComponentState2.default.getComponent('decision-card')]).then(function (payload) {
    console.log(payload);
    if (payload[0].length === 0) {
      console.log('there is no data');
      throw new Error('There is no data');
    } else {
      // $('.js-main-content').html('');
      _ClearHTML2.default.clearHtml('js-main-content');
      payload[0].forEach(function (dice) {
        _DecisionCardView2.default.createDecisionCard(dice, payload[1]);
      });
    }
  });
};

exports.default = { viewHome: viewHome };

},{"./DecisionCardView":8,"./Models/ComponentState":14,"./Models/DecisionListState":15,"./Utils/ClearHTML":17}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _constants = require('../Utils/constants');

var COMPONENTS_OBJ = {};

// add component to COMPONENTS_OBJ for caching
var addComponentToState = function addComponentToState(key, component) {
  COMPONENTS_OBJ[key] = component;
};

// return a COMPONENT by key from in-memory
var getComponent = function getComponent(key) {
  console.log('getComponent was called');
  return new Promise(function (res) {
    if (COMPONENTS_OBJ[key]) {
      res(COMPONENTS_OBJ[key]);
    } else {
      getComponentAPI(key).then(function () {
        return res(COMPONENTS_OBJ[key]);
      });
    }
  });
};

// get component templates from api
var getComponentAPI = function getComponentAPI(name) {
  return new Promise(function (res, rej) {
    var target = '/static/' + name + '.html';
    var urlString = '' + target;
    $.ajax({ url: urlString }).done(function (component) {
      addComponentToState(name, component);
      res(component);
      return;
    }).fail(function (err) {
      rej('cannot get component - Error: ' + err);
    });
  });
};

exports.default = { getComponent: getComponent };

},{"../Utils/constants":20}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _DiceModel = require('./DiceModel');

var _DiceModel2 = _interopRequireDefault(_DiceModel);

var _constants = require('../Utils/constants');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DECISION_LIST = [];

// add dice to decision list
var addDice = function addDice(dice) {
  DECISION_LIST.push(new _DiceModel2.default(dice));
};

// remove dice from decision list by ID
var removeDiceById = function removeDiceById(dice_id) {
  DECISION_LIST.splice(DECISION_LIST.indexOf(function (dice) {
    return dice === dice_id;
  }), 1);
};

// remove all dice to decision list
var removeAllDice = function removeAllDice() {
  DECISION_LIST.length = 0;
};

// return a list of dice from in-memory
var getDice = function getDice() {
  console.log('getDice was called');
  return new Promise(function (res) {
    if (DECISION_LIST.length !== 0) {
      res(DECISION_LIST);
    } else {
      getDecisionListApi().then(function () {
        return res(DECISION_LIST);
      });
    }
  });
};

// return a single dice from in-memory
var getDiceById = function getDiceById(decisionId) {
  console.log('getDiceById was called');
  return new Promise(function (res) {
    if (DECISION_LIST.length !== 0) {
      res(DECISION_LIST.find(function (dice) {
        return dice._id === decisionId;
      }));
    } else {
      getDecisionListApi().then(function () {
        return res(DECISION_LIST.find(function (dice) {
          return dice_id === decisionId;
        }));
      });
    }
  });
};

// get lists of decision dice from api
var getDecisionListApi = function getDecisionListApi() {
  console.log('getDecisionListApi was called');
  return new Promise(function (res, rej) {
    var target = '/decisions';
    var urlString = '' + target;
    $.ajax({ url: urlString }).done(function (allDiceInfo) {
      allDiceInfo.forEach(function (decision) {
        return addDice(decision);
      });
      res();
      return;
    }).fail(function (err) {
      rej('cannot get dice - Error: ' + err);
    });
  });
};

exports.default = { addDice: addDice, removeAllDice: removeAllDice, getDice: getDice, getDiceById: getDiceById, getDecisionListApi: getDecisionListApi };

},{"../Utils/constants":20,"./DiceModel":16}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _RandomNGenerator = require('../Utils/RandomNGenerator');

var _RandomNGenerator2 = _interopRequireDefault(_RandomNGenerator);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Dice = function () {
  function Dice(decision) {
    var _this = this;

    _classCallCheck(this, Dice);

    ;['_id', 'decision', 'options'].forEach(function (key) {
      if (!decision.hasOwnProperty(key)) {
        throw new Error('Parameter ' + key + ' is  required.');
      }
      _this[key] = decision[key];
    });
  }

  _createClass(Dice, [{
    key: 'roll',
    value: function roll() {
      var _this2 = this;

      return (0, _RandomNGenerator2.default)(1, this.options.length).then(function (chosenOption) {
        return _this2.options[chosenOption];
      });
    }
  }, {
    key: 'deleteOption',
    value: function deleteOption(optionId) {
      this.options.splice(this.options.indexOf(this.options.find(function (opt) {
        return opt.face === optionId;
      })), 1);
      return;
    }
  }, {
    key: 'addOption',
    value: function addOption(optionId, optionContent) {
      this.options.push({
        face: optionId,
        content: optionContent
      });
      return;
    }
  }], [{
    key: 'load',
    value: function load(diceId) {
      // get dice somehow from API and return a promise that resolves with a Dice
      // instance
      return jQuery.ajax('asdf', {
        data: {
          id: diceId
        }
      }).then(function (payload) {
        return new Dice(payload);
      });
    }
  }, {
    key: 'save',
    value: function save(dice) {}
  }, {
    key: 'delete',
    value: function _delete(dice) {}
  }, {
    key: 'find',
    value: function find(params) {}
  }]);

  return Dice;
}();
//
// Dice.load(1)
//   .then(dice => console.log(dice._id))
//   .catch(console.error)


exports.default = Dice;

},{"../Utils/RandomNGenerator":18}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var clearHtml = function clearHtml(elem) {
  $('.' + elem).html('');
  return;
};

exports.default = { clearHtml: clearHtml };

},{}],18:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = getRandomNumber;
function getRandomNumber(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Promise.resolve(Math.floor(Math.random() * (max - min)) + min);
};

// provided by:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random

},{}],19:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = replaceAll;
function replaceAll(str, mapObj) {
  var re = new RegExp(Object.keys(mapObj).join("|"), "gi");

  return str.replace(re, function (matched) {
    return mapObj[matched.toLowerCase()];
  });
}

// provided by:
// https://stackoverflow.com/questions/15604140/replace-multiple-strings-with-multiple-other-strings

},{}],20:[function(require,module,exports){
(function (process){
'use strict';

exports.PORT = process.env.PORT || 8080;

exports.BASE_URL = 'localhost';

}).call(this,require('_process'))

},{"_process":4}],21:[function(require,module,exports){
'use strict';

var _RandomNGenerator = require('./Utils/RandomNGenerator');

var _RandomNGenerator2 = _interopRequireDefault(_RandomNGenerator);

var _constants = require('./Utils/constants');

var _constants2 = _interopRequireDefault(_constants);

var _DiceModel = require('./Models/DiceModel');

var _DiceModel2 = _interopRequireDefault(_DiceModel);

var _DecisionListState = require('./Models/DecisionListState');

var _DecisionListState2 = _interopRequireDefault(_DecisionListState);

var _HomeViewManager = require('./HomeViewManager');

var _HomeViewManager2 = _interopRequireDefault(_HomeViewManager);

var _DicePageViewManager = require('./DicePageViewManager');

var _DicePageViewManager2 = _interopRequireDefault(_DicePageViewManager);

var _DiceEditViewManager = require('./DiceEditViewManager');

var _DiceEditViewManager2 = _interopRequireDefault(_DiceEditViewManager);

var _page = require('page');

var _page2 = _interopRequireDefault(_page);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// initialize page.js for routing in the front-end
(0, _page2.default)('/', _HomeViewManager2.default.viewHome);
// page('/dice', DiceVM.diceView);

// import {DiceView} from './DicePageViewManager';
(0, _page2.default)('/dice/:decisionId', _DicePageViewManager2.default.diceView);
(0, _page2.default)('/dice/edit/:decisionId', _DiceEditViewManager2.default.diceEditView);
// page('*', () => console.log('fall back'));
// page('/about', viewAbout);
// page('/sign-up', signUp);
// page('/sign-in', signIn);
// page('/sign-out', signOut);
// page('/new', createDice);
// page('/:username', userPage);
// page('/:username/:decisionId', viewDice);
// page('/:username/:decisionId/edit', editDice);
// page('/:username/:decisionId/delete', deleteDice);
//
(0, _page2.default)({ hashbang: false });

},{"./DiceEditViewManager":10,"./DicePageViewManager":12,"./HomeViewManager":13,"./Models/DecisionListState":15,"./Models/DiceModel":16,"./Utils/RandomNGenerator":18,"./Utils/constants":20,"page":2}]},{},[21])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvaXNhcnJheS9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wYWdlL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3BhZ2Uvbm9kZV9tb2R1bGVzL3BhdGgtdG8tcmVnZXhwL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Byb2Nlc3MvYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy91dWlkL2xpYi9ieXRlc1RvVXVpZC5qcyIsIm5vZGVfbW9kdWxlcy91dWlkL2xpYi9ybmctYnJvd3Nlci5qcyIsIm5vZGVfbW9kdWxlcy91dWlkL3Y0LmpzIiwic3JjL3NwYS9qcy9EZWNpc2lvbkNhcmRWaWV3LmpzIiwic3JjL3NwYS9qcy9EaWNlRWRpdFBhZ2VWaWV3LmpzIiwic3JjL3NwYS9qcy9EaWNlRWRpdFZpZXdNYW5hZ2VyLmpzIiwic3JjL3NwYS9qcy9EaWNlUGFnZVZpZXcuanMiLCJzcmMvc3BhL2pzL0RpY2VQYWdlVmlld01hbmFnZXIuanMiLCJzcmMvc3BhL2pzL0hvbWVWaWV3TWFuYWdlci5qcyIsInNyYy9zcGEvanMvTW9kZWxzL0NvbXBvbmVudFN0YXRlLmpzIiwic3JjL3NwYS9qcy9Nb2RlbHMvRGVjaXNpb25MaXN0U3RhdGUuanMiLCJzcmMvc3BhL2pzL01vZGVscy9EaWNlTW9kZWwuanMiLCJzcmMvc3BhL2pzL1V0aWxzL0NsZWFySFRNTC5qcyIsInNyYy9zcGEvanMvVXRpbHMvUmFuZG9tTkdlbmVyYXRvci5qcyIsInNyYy9zcGEvanMvVXRpbHMvU3RyaW5nUmVwbGFjZXIuanMiLCJzcmMvc3BhL2pzL1V0aWxzL2NvbnN0YW50cy5qcyIsInNyYy9zcGEvanMvaW5kZXguanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTs7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzltQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdFlBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDdkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7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Iiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJtb2R1bGUuZXhwb3J0cyA9IEFycmF5LmlzQXJyYXkgfHwgZnVuY3Rpb24gKGFycikge1xuICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFycikgPT0gJ1tvYmplY3QgQXJyYXldJztcbn07XG4iLCIgIC8qIGdsb2JhbHMgcmVxdWlyZSwgbW9kdWxlICovXG5cbiAgJ3VzZSBzdHJpY3QnO1xuXG4gIC8qKlxuICAgKiBNb2R1bGUgZGVwZW5kZW5jaWVzLlxuICAgKi9cblxuICB2YXIgcGF0aHRvUmVnZXhwID0gcmVxdWlyZSgncGF0aC10by1yZWdleHAnKTtcblxuICAvKipcbiAgICogTW9kdWxlIGV4cG9ydHMuXG4gICAqL1xuXG4gIG1vZHVsZS5leHBvcnRzID0gcGFnZTtcblxuICAvKipcbiAgICogRGV0ZWN0IGNsaWNrIGV2ZW50XG4gICAqL1xuICB2YXIgY2xpY2tFdmVudCA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGRvY3VtZW50KSAmJiBkb2N1bWVudC5vbnRvdWNoc3RhcnQgPyAndG91Y2hzdGFydCcgOiAnY2xpY2snO1xuXG4gIC8qKlxuICAgKiBUbyB3b3JrIHByb3Blcmx5IHdpdGggdGhlIFVSTFxuICAgKiBoaXN0b3J5LmxvY2F0aW9uIGdlbmVyYXRlZCBwb2x5ZmlsbCBpbiBodHRwczovL2dpdGh1Yi5jb20vZGV2b3RlL0hUTUw1LUhpc3RvcnktQVBJXG4gICAqL1xuXG4gIHZhciBsb2NhdGlvbiA9ICgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdpbmRvdykgJiYgKHdpbmRvdy5oaXN0b3J5LmxvY2F0aW9uIHx8IHdpbmRvdy5sb2NhdGlvbik7XG5cbiAgLyoqXG4gICAqIFBlcmZvcm0gaW5pdGlhbCBkaXNwYXRjaC5cbiAgICovXG5cbiAgdmFyIGRpc3BhdGNoID0gdHJ1ZTtcblxuXG4gIC8qKlxuICAgKiBEZWNvZGUgVVJMIGNvbXBvbmVudHMgKHF1ZXJ5IHN0cmluZywgcGF0aG5hbWUsIGhhc2gpLlxuICAgKiBBY2NvbW1vZGF0ZXMgYm90aCByZWd1bGFyIHBlcmNlbnQgZW5jb2RpbmcgYW5kIHgtd3d3LWZvcm0tdXJsZW5jb2RlZCBmb3JtYXQuXG4gICAqL1xuICB2YXIgZGVjb2RlVVJMQ29tcG9uZW50cyA9IHRydWU7XG5cbiAgLyoqXG4gICAqIEJhc2UgcGF0aC5cbiAgICovXG5cbiAgdmFyIGJhc2UgPSAnJztcblxuICAvKipcbiAgICogUnVubmluZyBmbGFnLlxuICAgKi9cblxuICB2YXIgcnVubmluZztcblxuICAvKipcbiAgICogSGFzaEJhbmcgb3B0aW9uXG4gICAqL1xuXG4gIHZhciBoYXNoYmFuZyA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBQcmV2aW91cyBjb250ZXh0LCBmb3IgY2FwdHVyaW5nXG4gICAqIHBhZ2UgZXhpdCBldmVudHMuXG4gICAqL1xuXG4gIHZhciBwcmV2Q29udGV4dDtcblxuICAvKipcbiAgICogUmVnaXN0ZXIgYHBhdGhgIHdpdGggY2FsbGJhY2sgYGZuKClgLFxuICAgKiBvciByb3V0ZSBgcGF0aGAsIG9yIHJlZGlyZWN0aW9uLFxuICAgKiBvciBgcGFnZS5zdGFydCgpYC5cbiAgICpcbiAgICogICBwYWdlKGZuKTtcbiAgICogICBwYWdlKCcqJywgZm4pO1xuICAgKiAgIHBhZ2UoJy91c2VyLzppZCcsIGxvYWQsIHVzZXIpO1xuICAgKiAgIHBhZ2UoJy91c2VyLycgKyB1c2VyLmlkLCB7IHNvbWU6ICd0aGluZycgfSk7XG4gICAqICAgcGFnZSgnL3VzZXIvJyArIHVzZXIuaWQpO1xuICAgKiAgIHBhZ2UoJy9mcm9tJywgJy90bycpXG4gICAqICAgcGFnZSgpO1xuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ3whRnVuY3Rpb258IU9iamVjdH0gcGF0aFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9uPX0gZm5cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgZnVuY3Rpb24gcGFnZShwYXRoLCBmbikge1xuICAgIC8vIDxjYWxsYmFjaz5cbiAgICBpZiAoJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIHBhdGgpIHtcbiAgICAgIHJldHVybiBwYWdlKCcqJywgcGF0aCk7XG4gICAgfVxuXG4gICAgLy8gcm91dGUgPHBhdGg+IHRvIDxjYWxsYmFjayAuLi4+XG4gICAgaWYgKCdmdW5jdGlvbicgPT09IHR5cGVvZiBmbikge1xuICAgICAgdmFyIHJvdXRlID0gbmV3IFJvdXRlKC8qKiBAdHlwZSB7c3RyaW5nfSAqLyAocGF0aCkpO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgcGFnZS5jYWxsYmFja3MucHVzaChyb3V0ZS5taWRkbGV3YXJlKGFyZ3VtZW50c1tpXSkpO1xuICAgICAgfVxuICAgICAgLy8gc2hvdyA8cGF0aD4gd2l0aCBbc3RhdGVdXG4gICAgfSBlbHNlIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIHBhdGgpIHtcbiAgICAgIHBhZ2VbJ3N0cmluZycgPT09IHR5cGVvZiBmbiA/ICdyZWRpcmVjdCcgOiAnc2hvdyddKHBhdGgsIGZuKTtcbiAgICAgIC8vIHN0YXJ0IFtvcHRpb25zXVxuICAgIH0gZWxzZSB7XG4gICAgICBwYWdlLnN0YXJ0KHBhdGgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayBmdW5jdGlvbnMuXG4gICAqL1xuXG4gIHBhZ2UuY2FsbGJhY2tzID0gW107XG4gIHBhZ2UuZXhpdHMgPSBbXTtcblxuICAvKipcbiAgICogQ3VycmVudCBwYXRoIGJlaW5nIHByb2Nlc3NlZFxuICAgKiBAdHlwZSB7c3RyaW5nfVxuICAgKi9cbiAgcGFnZS5jdXJyZW50ID0gJyc7XG5cbiAgLyoqXG4gICAqIE51bWJlciBvZiBwYWdlcyBuYXZpZ2F0ZWQgdG8uXG4gICAqIEB0eXBlIHtudW1iZXJ9XG4gICAqXG4gICAqICAgICBwYWdlLmxlbiA9PSAwO1xuICAgKiAgICAgcGFnZSgnL2xvZ2luJyk7XG4gICAqICAgICBwYWdlLmxlbiA9PSAxO1xuICAgKi9cblxuICBwYWdlLmxlbiA9IDA7XG5cbiAgLyoqXG4gICAqIEdldCBvciBzZXQgYmFzZXBhdGggdG8gYHBhdGhgLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBwYWdlLmJhc2UgPSBmdW5jdGlvbihwYXRoKSB7XG4gICAgaWYgKDAgPT09IGFyZ3VtZW50cy5sZW5ndGgpIHJldHVybiBiYXNlO1xuICAgIGJhc2UgPSBwYXRoO1xuICB9O1xuXG4gIC8qKlxuICAgKiBCaW5kIHdpdGggdGhlIGdpdmVuIGBvcHRpb25zYC5cbiAgICpcbiAgICogT3B0aW9uczpcbiAgICpcbiAgICogICAgLSBgY2xpY2tgIGJpbmQgdG8gY2xpY2sgZXZlbnRzIFt0cnVlXVxuICAgKiAgICAtIGBwb3BzdGF0ZWAgYmluZCB0byBwb3BzdGF0ZSBbdHJ1ZV1cbiAgICogICAgLSBgZGlzcGF0Y2hgIHBlcmZvcm0gaW5pdGlhbCBkaXNwYXRjaCBbdHJ1ZV1cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgcGFnZS5zdGFydCA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICBpZiAocnVubmluZykgcmV0dXJuO1xuICAgIHJ1bm5pbmcgPSB0cnVlO1xuICAgIGlmIChmYWxzZSA9PT0gb3B0aW9ucy5kaXNwYXRjaCkgZGlzcGF0Y2ggPSBmYWxzZTtcbiAgICBpZiAoZmFsc2UgPT09IG9wdGlvbnMuZGVjb2RlVVJMQ29tcG9uZW50cykgZGVjb2RlVVJMQ29tcG9uZW50cyA9IGZhbHNlO1xuICAgIGlmIChmYWxzZSAhPT0gb3B0aW9ucy5wb3BzdGF0ZSkgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgb25wb3BzdGF0ZSwgZmFsc2UpO1xuICAgIGlmIChmYWxzZSAhPT0gb3B0aW9ucy5jbGljaykge1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihjbGlja0V2ZW50LCBvbmNsaWNrLCBmYWxzZSk7XG4gICAgfVxuICAgIGlmICh0cnVlID09PSBvcHRpb25zLmhhc2hiYW5nKSBoYXNoYmFuZyA9IHRydWU7XG4gICAgaWYgKCFkaXNwYXRjaCkgcmV0dXJuO1xuICAgIHZhciB1cmwgPSAoaGFzaGJhbmcgJiYgfmxvY2F0aW9uLmhhc2guaW5kZXhPZignIyEnKSkgPyBsb2NhdGlvbi5oYXNoLnN1YnN0cigyKSArIGxvY2F0aW9uLnNlYXJjaCA6IGxvY2F0aW9uLnBhdGhuYW1lICsgbG9jYXRpb24uc2VhcmNoICsgbG9jYXRpb24uaGFzaDtcbiAgICBwYWdlLnJlcGxhY2UodXJsLCBudWxsLCB0cnVlLCBkaXNwYXRjaCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFVuYmluZCBjbGljayBhbmQgcG9wc3RhdGUgZXZlbnQgaGFuZGxlcnMuXG4gICAqXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHBhZ2Uuc3RvcCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICghcnVubmluZykgcmV0dXJuO1xuICAgIHBhZ2UuY3VycmVudCA9ICcnO1xuICAgIHBhZ2UubGVuID0gMDtcbiAgICBydW5uaW5nID0gZmFsc2U7XG4gICAgZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcihjbGlja0V2ZW50LCBvbmNsaWNrLCBmYWxzZSk7XG4gICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3BvcHN0YXRlJywgb25wb3BzdGF0ZSwgZmFsc2UpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTaG93IGBwYXRoYCB3aXRoIG9wdGlvbmFsIGBzdGF0ZWAgb2JqZWN0LlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge09iamVjdD19IHN0YXRlXG4gICAqIEBwYXJhbSB7Ym9vbGVhbj19IGRpc3BhdGNoXG4gICAqIEBwYXJhbSB7Ym9vbGVhbj19IHB1c2hcbiAgICogQHJldHVybiB7IUNvbnRleHR9XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIHBhZ2Uuc2hvdyA9IGZ1bmN0aW9uKHBhdGgsIHN0YXRlLCBkaXNwYXRjaCwgcHVzaCkge1xuICAgIHZhciBjdHggPSBuZXcgQ29udGV4dChwYXRoLCBzdGF0ZSk7XG4gICAgcGFnZS5jdXJyZW50ID0gY3R4LnBhdGg7XG4gICAgaWYgKGZhbHNlICE9PSBkaXNwYXRjaCkgcGFnZS5kaXNwYXRjaChjdHgpO1xuICAgIGlmIChmYWxzZSAhPT0gY3R4LmhhbmRsZWQgJiYgZmFsc2UgIT09IHB1c2gpIGN0eC5wdXNoU3RhdGUoKTtcbiAgICByZXR1cm4gY3R4O1xuICB9O1xuXG4gIC8qKlxuICAgKiBHb2VzIGJhY2sgaW4gdGhlIGhpc3RvcnlcbiAgICogQmFjayBzaG91bGQgYWx3YXlzIGxldCB0aGUgY3VycmVudCByb3V0ZSBwdXNoIHN0YXRlIGFuZCB0aGVuIGdvIGJhY2suXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoIC0gZmFsbGJhY2sgcGF0aCB0byBnbyBiYWNrIGlmIG5vIG1vcmUgaGlzdG9yeSBleGlzdHMsIGlmIHVuZGVmaW5lZCBkZWZhdWx0cyB0byBwYWdlLmJhc2VcbiAgICogQHBhcmFtIHtPYmplY3Q9fSBzdGF0ZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBwYWdlLmJhY2sgPSBmdW5jdGlvbihwYXRoLCBzdGF0ZSkge1xuICAgIGlmIChwYWdlLmxlbiA+IDApIHtcbiAgICAgIC8vIHRoaXMgbWF5IG5lZWQgbW9yZSB0ZXN0aW5nIHRvIHNlZSBpZiBhbGwgYnJvd3NlcnNcbiAgICAgIC8vIHdhaXQgZm9yIHRoZSBuZXh0IHRpY2sgdG8gZ28gYmFjayBpbiBoaXN0b3J5XG4gICAgICBoaXN0b3J5LmJhY2soKTtcbiAgICAgIHBhZ2UubGVuLS07XG4gICAgfSBlbHNlIGlmIChwYXRoKSB7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBwYWdlLnNob3cocGF0aCwgc3RhdGUpO1xuICAgICAgfSk7XG4gICAgfWVsc2V7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBwYWdlLnNob3coYmFzZSwgc3RhdGUpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIHJvdXRlIHRvIHJlZGlyZWN0IGZyb20gb25lIHBhdGggdG8gb3RoZXJcbiAgICogb3IganVzdCByZWRpcmVjdCB0byBhbm90aGVyIHJvdXRlXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBmcm9tIC0gaWYgcGFyYW0gJ3RvJyBpcyB1bmRlZmluZWQgcmVkaXJlY3RzIHRvICdmcm9tJ1xuICAgKiBAcGFyYW0ge3N0cmluZz19IHRvXG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuICBwYWdlLnJlZGlyZWN0ID0gZnVuY3Rpb24oZnJvbSwgdG8pIHtcbiAgICAvLyBEZWZpbmUgcm91dGUgZnJvbSBhIHBhdGggdG8gYW5vdGhlclxuICAgIGlmICgnc3RyaW5nJyA9PT0gdHlwZW9mIGZyb20gJiYgJ3N0cmluZycgPT09IHR5cGVvZiB0bykge1xuICAgICAgcGFnZShmcm9tLCBmdW5jdGlvbihlKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgcGFnZS5yZXBsYWNlKC8qKiBAdHlwZSB7IXN0cmluZ30gKi8gKHRvKSk7XG4gICAgICAgIH0sIDApO1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gV2FpdCBmb3IgdGhlIHB1c2ggc3RhdGUgYW5kIHJlcGxhY2UgaXQgd2l0aCBhbm90aGVyXG4gICAgaWYgKCdzdHJpbmcnID09PSB0eXBlb2YgZnJvbSAmJiAndW5kZWZpbmVkJyA9PT0gdHlwZW9mIHRvKSB7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICBwYWdlLnJlcGxhY2UoZnJvbSk7XG4gICAgICB9LCAwKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlcGxhY2UgYHBhdGhgIHdpdGggb3B0aW9uYWwgYHN0YXRlYCBvYmplY3QuXG4gICAqXG4gICAqIEBwYXJhbSB7c3RyaW5nfSBwYXRoXG4gICAqIEBwYXJhbSB7T2JqZWN0PX0gc3RhdGVcbiAgICogQHBhcmFtIHtib29sZWFuPX0gaW5pdFxuICAgKiBAcGFyYW0ge2Jvb2xlYW49fSBkaXNwYXRjaFxuICAgKiBAcmV0dXJuIHshQ29udGV4dH1cbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cblxuICBwYWdlLnJlcGxhY2UgPSBmdW5jdGlvbihwYXRoLCBzdGF0ZSwgaW5pdCwgZGlzcGF0Y2gpIHtcbiAgICB2YXIgY3R4ID0gbmV3IENvbnRleHQocGF0aCwgc3RhdGUpO1xuICAgIHBhZ2UuY3VycmVudCA9IGN0eC5wYXRoO1xuICAgIGN0eC5pbml0ID0gaW5pdDtcbiAgICBjdHguc2F2ZSgpOyAvLyBzYXZlIGJlZm9yZSBkaXNwYXRjaGluZywgd2hpY2ggbWF5IHJlZGlyZWN0XG4gICAgaWYgKGZhbHNlICE9PSBkaXNwYXRjaCkgcGFnZS5kaXNwYXRjaChjdHgpO1xuICAgIHJldHVybiBjdHg7XG4gIH07XG5cbiAgLyoqXG4gICAqIERpc3BhdGNoIHRoZSBnaXZlbiBgY3R4YC5cbiAgICpcbiAgICogQHBhcmFtIHtDb250ZXh0fSBjdHhcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuICBwYWdlLmRpc3BhdGNoID0gZnVuY3Rpb24oY3R4KSB7XG4gICAgdmFyIHByZXYgPSBwcmV2Q29udGV4dCxcbiAgICAgIGkgPSAwLFxuICAgICAgaiA9IDA7XG5cbiAgICBwcmV2Q29udGV4dCA9IGN0eDtcblxuICAgIGZ1bmN0aW9uIG5leHRFeGl0KCkge1xuICAgICAgdmFyIGZuID0gcGFnZS5leGl0c1tqKytdO1xuICAgICAgaWYgKCFmbikgcmV0dXJuIG5leHRFbnRlcigpO1xuICAgICAgZm4ocHJldiwgbmV4dEV4aXQpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG5leHRFbnRlcigpIHtcbiAgICAgIHZhciBmbiA9IHBhZ2UuY2FsbGJhY2tzW2krK107XG5cbiAgICAgIGlmIChjdHgucGF0aCAhPT0gcGFnZS5jdXJyZW50KSB7XG4gICAgICAgIGN0eC5oYW5kbGVkID0gZmFsc2U7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmICghZm4pIHJldHVybiB1bmhhbmRsZWQoY3R4KTtcbiAgICAgIGZuKGN0eCwgbmV4dEVudGVyKTtcbiAgICB9XG5cbiAgICBpZiAocHJldikge1xuICAgICAgbmV4dEV4aXQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmV4dEVudGVyKCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBVbmhhbmRsZWQgYGN0eGAuIFdoZW4gaXQncyBub3QgdGhlIGluaXRpYWxcbiAgICogcG9wc3RhdGUgdGhlbiByZWRpcmVjdC4gSWYgeW91IHdpc2ggdG8gaGFuZGxlXG4gICAqIDQwNHMgb24geW91ciBvd24gdXNlIGBwYWdlKCcqJywgY2FsbGJhY2spYC5cbiAgICpcbiAgICogQHBhcmFtIHtDb250ZXh0fSBjdHhcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuICBmdW5jdGlvbiB1bmhhbmRsZWQoY3R4KSB7XG4gICAgaWYgKGN0eC5oYW5kbGVkKSByZXR1cm47XG4gICAgdmFyIGN1cnJlbnQ7XG5cbiAgICBpZiAoaGFzaGJhbmcpIHtcbiAgICAgIGN1cnJlbnQgPSBiYXNlICsgbG9jYXRpb24uaGFzaC5yZXBsYWNlKCcjIScsICcnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudCA9IGxvY2F0aW9uLnBhdGhuYW1lICsgbG9jYXRpb24uc2VhcmNoO1xuICAgIH1cblxuICAgIGlmIChjdXJyZW50ID09PSBjdHguY2Fub25pY2FsUGF0aCkgcmV0dXJuO1xuICAgIHBhZ2Uuc3RvcCgpO1xuICAgIGN0eC5oYW5kbGVkID0gZmFsc2U7XG4gICAgbG9jYXRpb24uaHJlZiA9IGN0eC5jYW5vbmljYWxQYXRoO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGFuIGV4aXQgcm91dGUgb24gYHBhdGhgIHdpdGhcbiAgICogY2FsbGJhY2sgYGZuKClgLCB3aGljaCB3aWxsIGJlIGNhbGxlZFxuICAgKiBvbiB0aGUgcHJldmlvdXMgY29udGV4dCB3aGVuIGEgbmV3XG4gICAqIHBhZ2UgaXMgdmlzaXRlZC5cbiAgICovXG4gIHBhZ2UuZXhpdCA9IGZ1bmN0aW9uKHBhdGgsIGZuKSB7XG4gICAgaWYgKHR5cGVvZiBwYXRoID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICByZXR1cm4gcGFnZS5leGl0KCcqJywgcGF0aCk7XG4gICAgfVxuXG4gICAgdmFyIHJvdXRlID0gbmV3IFJvdXRlKHBhdGgpO1xuICAgIGZvciAodmFyIGkgPSAxOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgKytpKSB7XG4gICAgICBwYWdlLmV4aXRzLnB1c2gocm91dGUubWlkZGxld2FyZShhcmd1bWVudHNbaV0pKTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBVUkwgZW5jb2RpbmcgZnJvbSB0aGUgZ2l2ZW4gYHN0cmAuXG4gICAqIEFjY29tbW9kYXRlcyB3aGl0ZXNwYWNlIGluIGJvdGggeC13d3ctZm9ybS11cmxlbmNvZGVkXG4gICAqIGFuZCByZWd1bGFyIHBlcmNlbnQtZW5jb2RlZCBmb3JtLlxuICAgKlxuICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsIC0gVVJMIGNvbXBvbmVudCB0byBkZWNvZGVcbiAgICovXG4gIGZ1bmN0aW9uIGRlY29kZVVSTEVuY29kZWRVUklDb21wb25lbnQodmFsKSB7XG4gICAgaWYgKHR5cGVvZiB2YWwgIT09ICdzdHJpbmcnKSB7IHJldHVybiB2YWw7IH1cbiAgICByZXR1cm4gZGVjb2RlVVJMQ29tcG9uZW50cyA/IGRlY29kZVVSSUNvbXBvbmVudCh2YWwucmVwbGFjZSgvXFwrL2csICcgJykpIDogdmFsO1xuICB9XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgYSBuZXcgXCJyZXF1ZXN0XCIgYENvbnRleHRgXG4gICAqIHdpdGggdGhlIGdpdmVuIGBwYXRoYCBhbmQgb3B0aW9uYWwgaW5pdGlhbCBgc3RhdGVgLlxuICAgKlxuICAgKiBAY29uc3RydWN0b3JcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtPYmplY3Q9fSBzdGF0ZVxuICAgKiBAYXBpIHB1YmxpY1xuICAgKi9cblxuICBmdW5jdGlvbiBDb250ZXh0KHBhdGgsIHN0YXRlKSB7XG4gICAgaWYgKCcvJyA9PT0gcGF0aFswXSAmJiAwICE9PSBwYXRoLmluZGV4T2YoYmFzZSkpIHBhdGggPSBiYXNlICsgKGhhc2hiYW5nID8gJyMhJyA6ICcnKSArIHBhdGg7XG4gICAgdmFyIGkgPSBwYXRoLmluZGV4T2YoJz8nKTtcblxuICAgIHRoaXMuY2Fub25pY2FsUGF0aCA9IHBhdGg7XG4gICAgdGhpcy5wYXRoID0gcGF0aC5yZXBsYWNlKGJhc2UsICcnKSB8fCAnLyc7XG4gICAgaWYgKGhhc2hiYW5nKSB0aGlzLnBhdGggPSB0aGlzLnBhdGgucmVwbGFjZSgnIyEnLCAnJykgfHwgJy8nO1xuXG4gICAgdGhpcy50aXRsZSA9IGRvY3VtZW50LnRpdGxlO1xuICAgIHRoaXMuc3RhdGUgPSBzdGF0ZSB8fCB7fTtcbiAgICB0aGlzLnN0YXRlLnBhdGggPSBwYXRoO1xuICAgIHRoaXMucXVlcnlzdHJpbmcgPSB+aSA/IGRlY29kZVVSTEVuY29kZWRVUklDb21wb25lbnQocGF0aC5zbGljZShpICsgMSkpIDogJyc7XG4gICAgdGhpcy5wYXRobmFtZSA9IGRlY29kZVVSTEVuY29kZWRVUklDb21wb25lbnQofmkgPyBwYXRoLnNsaWNlKDAsIGkpIDogcGF0aCk7XG4gICAgdGhpcy5wYXJhbXMgPSB7fTtcblxuICAgIC8vIGZyYWdtZW50XG4gICAgdGhpcy5oYXNoID0gJyc7XG4gICAgaWYgKCFoYXNoYmFuZykge1xuICAgICAgaWYgKCF+dGhpcy5wYXRoLmluZGV4T2YoJyMnKSkgcmV0dXJuO1xuICAgICAgdmFyIHBhcnRzID0gdGhpcy5wYXRoLnNwbGl0KCcjJyk7XG4gICAgICB0aGlzLnBhdGggPSBwYXJ0c1swXTtcbiAgICAgIHRoaXMuaGFzaCA9IGRlY29kZVVSTEVuY29kZWRVUklDb21wb25lbnQocGFydHNbMV0pIHx8ICcnO1xuICAgICAgdGhpcy5xdWVyeXN0cmluZyA9IHRoaXMucXVlcnlzdHJpbmcuc3BsaXQoJyMnKVswXTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXhwb3NlIGBDb250ZXh0YC5cbiAgICovXG5cbiAgcGFnZS5Db250ZXh0ID0gQ29udGV4dDtcblxuICAvKipcbiAgICogUHVzaCBzdGF0ZS5cbiAgICpcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIENvbnRleHQucHJvdG90eXBlLnB1c2hTdGF0ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHBhZ2UubGVuKys7XG4gICAgaGlzdG9yeS5wdXNoU3RhdGUodGhpcy5zdGF0ZSwgdGhpcy50aXRsZSwgaGFzaGJhbmcgJiYgdGhpcy5wYXRoICE9PSAnLycgPyAnIyEnICsgdGhpcy5wYXRoIDogdGhpcy5jYW5vbmljYWxQYXRoKTtcbiAgfTtcblxuICAvKipcbiAgICogU2F2ZSB0aGUgY29udGV4dCBzdGF0ZS5cbiAgICpcbiAgICogQGFwaSBwdWJsaWNcbiAgICovXG5cbiAgQ29udGV4dC5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgIGhpc3RvcnkucmVwbGFjZVN0YXRlKHRoaXMuc3RhdGUsIHRoaXMudGl0bGUsIGhhc2hiYW5nICYmIHRoaXMucGF0aCAhPT0gJy8nID8gJyMhJyArIHRoaXMucGF0aCA6IHRoaXMuY2Fub25pY2FsUGF0aCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgYFJvdXRlYCB3aXRoIHRoZSBnaXZlbiBIVFRQIGBwYXRoYCxcbiAgICogYW5kIGFuIGFycmF5IG9mIGBjYWxsYmFja3NgIGFuZCBgb3B0aW9uc2AuXG4gICAqXG4gICAqIE9wdGlvbnM6XG4gICAqXG4gICAqICAgLSBgc2Vuc2l0aXZlYCAgICBlbmFibGUgY2FzZS1zZW5zaXRpdmUgcm91dGVzXG4gICAqICAgLSBgc3RyaWN0YCAgICAgICBlbmFibGUgc3RyaWN0IG1hdGNoaW5nIGZvciB0cmFpbGluZyBzbGFzaGVzXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ge3N0cmluZ30gcGF0aFxuICAgKiBAcGFyYW0ge09iamVjdD19IG9wdGlvbnNcbiAgICogQGFwaSBwcml2YXRlXG4gICAqL1xuXG4gIGZ1bmN0aW9uIFJvdXRlKHBhdGgsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB0aGlzLnBhdGggPSAocGF0aCA9PT0gJyonKSA/ICcoLiopJyA6IHBhdGg7XG4gICAgdGhpcy5tZXRob2QgPSAnR0VUJztcbiAgICB0aGlzLnJlZ2V4cCA9IHBhdGh0b1JlZ2V4cCh0aGlzLnBhdGgsXG4gICAgICB0aGlzLmtleXMgPSBbXSxcbiAgICAgIG9wdGlvbnMpO1xuICB9XG5cbiAgLyoqXG4gICAqIEV4cG9zZSBgUm91dGVgLlxuICAgKi9cblxuICBwYWdlLlJvdXRlID0gUm91dGU7XG5cbiAgLyoqXG4gICAqIFJldHVybiByb3V0ZSBtaWRkbGV3YXJlIHdpdGhcbiAgICogdGhlIGdpdmVuIGNhbGxiYWNrIGBmbigpYC5cbiAgICpcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICogQHJldHVybiB7RnVuY3Rpb259XG4gICAqIEBhcGkgcHVibGljXG4gICAqL1xuXG4gIFJvdXRlLnByb3RvdHlwZS5taWRkbGV3YXJlID0gZnVuY3Rpb24oZm4pIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKGN0eCwgbmV4dCkge1xuICAgICAgaWYgKHNlbGYubWF0Y2goY3R4LnBhdGgsIGN0eC5wYXJhbXMpKSByZXR1cm4gZm4oY3R4LCBuZXh0KTtcbiAgICAgIG5leHQoKTtcbiAgICB9O1xuICB9O1xuXG4gIC8qKlxuICAgKiBDaGVjayBpZiB0aGlzIHJvdXRlIG1hdGNoZXMgYHBhdGhgLCBpZiBzb1xuICAgKiBwb3B1bGF0ZSBgcGFyYW1zYC5cbiAgICpcbiAgICogQHBhcmFtIHtzdHJpbmd9IHBhdGhcbiAgICogQHBhcmFtIHtPYmplY3R9IHBhcmFtc1xuICAgKiBAcmV0dXJuIHtib29sZWFufVxuICAgKiBAYXBpIHByaXZhdGVcbiAgICovXG5cbiAgUm91dGUucHJvdG90eXBlLm1hdGNoID0gZnVuY3Rpb24ocGF0aCwgcGFyYW1zKSB7XG4gICAgdmFyIGtleXMgPSB0aGlzLmtleXMsXG4gICAgICBxc0luZGV4ID0gcGF0aC5pbmRleE9mKCc/JyksXG4gICAgICBwYXRobmFtZSA9IH5xc0luZGV4ID8gcGF0aC5zbGljZSgwLCBxc0luZGV4KSA6IHBhdGgsXG4gICAgICBtID0gdGhpcy5yZWdleHAuZXhlYyhkZWNvZGVVUklDb21wb25lbnQocGF0aG5hbWUpKTtcblxuICAgIGlmICghbSkgcmV0dXJuIGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDEsIGxlbiA9IG0ubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICAgIHZhciBrZXkgPSBrZXlzW2kgLSAxXTtcbiAgICAgIHZhciB2YWwgPSBkZWNvZGVVUkxFbmNvZGVkVVJJQ29tcG9uZW50KG1baV0pO1xuICAgICAgaWYgKHZhbCAhPT0gdW5kZWZpbmVkIHx8ICEoaGFzT3duUHJvcGVydHkuY2FsbChwYXJhbXMsIGtleS5uYW1lKSkpIHtcbiAgICAgICAgcGFyYW1zW2tleS5uYW1lXSA9IHZhbDtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcblxuXG4gIC8qKlxuICAgKiBIYW5kbGUgXCJwb3B1bGF0ZVwiIGV2ZW50cy5cbiAgICovXG5cbiAgdmFyIG9ucG9wc3RhdGUgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBsb2FkZWQgPSBmYWxzZTtcbiAgICBpZiAoJ3VuZGVmaW5lZCcgPT09IHR5cGVvZiB3aW5kb3cpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgIGxvYWRlZCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgZnVuY3Rpb24oKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgbG9hZGVkID0gdHJ1ZTtcbiAgICAgICAgfSwgMCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIGZ1bmN0aW9uIG9ucG9wc3RhdGUoZSkge1xuICAgICAgaWYgKCFsb2FkZWQpIHJldHVybjtcbiAgICAgIGlmIChlLnN0YXRlKSB7XG4gICAgICAgIHZhciBwYXRoID0gZS5zdGF0ZS5wYXRoO1xuICAgICAgICBwYWdlLnJlcGxhY2UocGF0aCwgZS5zdGF0ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYWdlLnNob3cobG9jYXRpb24ucGF0aG5hbWUgKyBsb2NhdGlvbi5oYXNoLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZmFsc2UpO1xuICAgICAgfVxuICAgIH07XG4gIH0pKCk7XG4gIC8qKlxuICAgKiBIYW5kbGUgXCJjbGlja1wiIGV2ZW50cy5cbiAgICovXG5cbiAgZnVuY3Rpb24gb25jbGljayhlKSB7XG5cbiAgICBpZiAoMSAhPT0gd2hpY2goZSkpIHJldHVybjtcblxuICAgIGlmIChlLm1ldGFLZXkgfHwgZS5jdHJsS2V5IHx8IGUuc2hpZnRLZXkpIHJldHVybjtcbiAgICBpZiAoZS5kZWZhdWx0UHJldmVudGVkKSByZXR1cm47XG5cblxuXG4gICAgLy8gZW5zdXJlIGxpbmtcbiAgICAvLyB1c2Ugc2hhZG93IGRvbSB3aGVuIGF2YWlsYWJsZVxuICAgIHZhciBlbCA9IGUucGF0aCA/IGUucGF0aFswXSA6IGUudGFyZ2V0O1xuICAgIHdoaWxlIChlbCAmJiAnQScgIT09IGVsLm5vZGVOYW1lKSBlbCA9IGVsLnBhcmVudE5vZGU7XG4gICAgaWYgKCFlbCB8fCAnQScgIT09IGVsLm5vZGVOYW1lKSByZXR1cm47XG5cblxuXG4gICAgLy8gSWdub3JlIGlmIHRhZyBoYXNcbiAgICAvLyAxLiBcImRvd25sb2FkXCIgYXR0cmlidXRlXG4gICAgLy8gMi4gcmVsPVwiZXh0ZXJuYWxcIiBhdHRyaWJ1dGVcbiAgICBpZiAoZWwuaGFzQXR0cmlidXRlKCdkb3dubG9hZCcpIHx8IGVsLmdldEF0dHJpYnV0ZSgncmVsJykgPT09ICdleHRlcm5hbCcpIHJldHVybjtcblxuICAgIC8vIGVuc3VyZSBub24taGFzaCBmb3IgdGhlIHNhbWUgcGF0aFxuICAgIHZhciBsaW5rID0gZWwuZ2V0QXR0cmlidXRlKCdocmVmJyk7XG4gICAgaWYgKCFoYXNoYmFuZyAmJiBlbC5wYXRobmFtZSA9PT0gbG9jYXRpb24ucGF0aG5hbWUgJiYgKGVsLmhhc2ggfHwgJyMnID09PSBsaW5rKSkgcmV0dXJuO1xuXG5cblxuICAgIC8vIENoZWNrIGZvciBtYWlsdG86IGluIHRoZSBocmVmXG4gICAgaWYgKGxpbmsgJiYgbGluay5pbmRleE9mKCdtYWlsdG86JykgPiAtMSkgcmV0dXJuO1xuXG4gICAgLy8gY2hlY2sgdGFyZ2V0XG4gICAgaWYgKGVsLnRhcmdldCkgcmV0dXJuO1xuXG4gICAgLy8geC1vcmlnaW5cbiAgICBpZiAoIXNhbWVPcmlnaW4oZWwuaHJlZikpIHJldHVybjtcblxuXG5cbiAgICAvLyByZWJ1aWxkIHBhdGhcbiAgICB2YXIgcGF0aCA9IGVsLnBhdGhuYW1lICsgZWwuc2VhcmNoICsgKGVsLmhhc2ggfHwgJycpO1xuXG4gICAgLy8gc3RyaXAgbGVhZGluZyBcIi9bZHJpdmUgbGV0dGVyXTpcIiBvbiBOVy5qcyBvbiBXaW5kb3dzXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzICE9PSAndW5kZWZpbmVkJyAmJiBwYXRoLm1hdGNoKC9eXFwvW2EtekEtWl06XFwvLykpIHtcbiAgICAgIHBhdGggPSBwYXRoLnJlcGxhY2UoL15cXC9bYS16QS1aXTpcXC8vLCAnLycpO1xuICAgIH1cblxuICAgIC8vIHNhbWUgcGFnZVxuICAgIHZhciBvcmlnID0gcGF0aDtcblxuICAgIGlmIChwYXRoLmluZGV4T2YoYmFzZSkgPT09IDApIHtcbiAgICAgIHBhdGggPSBwYXRoLnN1YnN0cihiYXNlLmxlbmd0aCk7XG4gICAgfVxuXG4gICAgaWYgKGhhc2hiYW5nKSBwYXRoID0gcGF0aC5yZXBsYWNlKCcjIScsICcnKTtcblxuICAgIGlmIChiYXNlICYmIG9yaWcgPT09IHBhdGgpIHJldHVybjtcblxuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICBwYWdlLnNob3cob3JpZyk7XG4gIH1cblxuICAvKipcbiAgICogRXZlbnQgYnV0dG9uLlxuICAgKi9cblxuICBmdW5jdGlvbiB3aGljaChlKSB7XG4gICAgZSA9IGUgfHwgd2luZG93LmV2ZW50O1xuICAgIHJldHVybiBudWxsID09PSBlLndoaWNoID8gZS5idXR0b24gOiBlLndoaWNoO1xuICB9XG5cbiAgLyoqXG4gICAqIENoZWNrIGlmIGBocmVmYCBpcyB0aGUgc2FtZSBvcmlnaW4uXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHNhbWVPcmlnaW4oaHJlZikge1xuICAgIHZhciBvcmlnaW4gPSBsb2NhdGlvbi5wcm90b2NvbCArICcvLycgKyBsb2NhdGlvbi5ob3N0bmFtZTtcbiAgICBpZiAobG9jYXRpb24ucG9ydCkgb3JpZ2luICs9ICc6JyArIGxvY2F0aW9uLnBvcnQ7XG4gICAgcmV0dXJuIChocmVmICYmICgwID09PSBocmVmLmluZGV4T2Yob3JpZ2luKSkpO1xuICB9XG5cbiAgcGFnZS5zYW1lT3JpZ2luID0gc2FtZU9yaWdpbjtcbiIsInZhciBpc2FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpXG5cbi8qKlxuICogRXhwb3NlIGBwYXRoVG9SZWdleHBgLlxuICovXG5tb2R1bGUuZXhwb3J0cyA9IHBhdGhUb1JlZ2V4cFxubW9kdWxlLmV4cG9ydHMucGFyc2UgPSBwYXJzZVxubW9kdWxlLmV4cG9ydHMuY29tcGlsZSA9IGNvbXBpbGVcbm1vZHVsZS5leHBvcnRzLnRva2Vuc1RvRnVuY3Rpb24gPSB0b2tlbnNUb0Z1bmN0aW9uXG5tb2R1bGUuZXhwb3J0cy50b2tlbnNUb1JlZ0V4cCA9IHRva2Vuc1RvUmVnRXhwXG5cbi8qKlxuICogVGhlIG1haW4gcGF0aCBtYXRjaGluZyByZWdleHAgdXRpbGl0eS5cbiAqXG4gKiBAdHlwZSB7UmVnRXhwfVxuICovXG52YXIgUEFUSF9SRUdFWFAgPSBuZXcgUmVnRXhwKFtcbiAgLy8gTWF0Y2ggZXNjYXBlZCBjaGFyYWN0ZXJzIHRoYXQgd291bGQgb3RoZXJ3aXNlIGFwcGVhciBpbiBmdXR1cmUgbWF0Y2hlcy5cbiAgLy8gVGhpcyBhbGxvd3MgdGhlIHVzZXIgdG8gZXNjYXBlIHNwZWNpYWwgY2hhcmFjdGVycyB0aGF0IHdvbid0IHRyYW5zZm9ybS5cbiAgJyhcXFxcXFxcXC4pJyxcbiAgLy8gTWF0Y2ggRXhwcmVzcy1zdHlsZSBwYXJhbWV0ZXJzIGFuZCB1bi1uYW1lZCBwYXJhbWV0ZXJzIHdpdGggYSBwcmVmaXhcbiAgLy8gYW5kIG9wdGlvbmFsIHN1ZmZpeGVzLiBNYXRjaGVzIGFwcGVhciBhczpcbiAgLy9cbiAgLy8gXCIvOnRlc3QoXFxcXGQrKT9cIiA9PiBbXCIvXCIsIFwidGVzdFwiLCBcIlxcZCtcIiwgdW5kZWZpbmVkLCBcIj9cIiwgdW5kZWZpbmVkXVxuICAvLyBcIi9yb3V0ZShcXFxcZCspXCIgID0+IFt1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBcIlxcZCtcIiwgdW5kZWZpbmVkLCB1bmRlZmluZWRdXG4gIC8vIFwiLypcIiAgICAgICAgICAgID0+IFtcIi9cIiwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBcIipcIl1cbiAgJyhbXFxcXC8uXSk/KD86KD86XFxcXDooXFxcXHcrKSg/OlxcXFwoKCg/OlxcXFxcXFxcLnxbXigpXSkrKVxcXFwpKT98XFxcXCgoKD86XFxcXFxcXFwufFteKCldKSspXFxcXCkpKFsrKj9dKT98KFxcXFwqKSknXG5dLmpvaW4oJ3wnKSwgJ2cnKVxuXG4vKipcbiAqIFBhcnNlIGEgc3RyaW5nIGZvciB0aGUgcmF3IHRva2Vucy5cbiAqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7QXJyYXl9XG4gKi9cbmZ1bmN0aW9uIHBhcnNlIChzdHIpIHtcbiAgdmFyIHRva2VucyA9IFtdXG4gIHZhciBrZXkgPSAwXG4gIHZhciBpbmRleCA9IDBcbiAgdmFyIHBhdGggPSAnJ1xuICB2YXIgcmVzXG5cbiAgd2hpbGUgKChyZXMgPSBQQVRIX1JFR0VYUC5leGVjKHN0cikpICE9IG51bGwpIHtcbiAgICB2YXIgbSA9IHJlc1swXVxuICAgIHZhciBlc2NhcGVkID0gcmVzWzFdXG4gICAgdmFyIG9mZnNldCA9IHJlcy5pbmRleFxuICAgIHBhdGggKz0gc3RyLnNsaWNlKGluZGV4LCBvZmZzZXQpXG4gICAgaW5kZXggPSBvZmZzZXQgKyBtLmxlbmd0aFxuXG4gICAgLy8gSWdub3JlIGFscmVhZHkgZXNjYXBlZCBzZXF1ZW5jZXMuXG4gICAgaWYgKGVzY2FwZWQpIHtcbiAgICAgIHBhdGggKz0gZXNjYXBlZFsxXVxuICAgICAgY29udGludWVcbiAgICB9XG5cbiAgICAvLyBQdXNoIHRoZSBjdXJyZW50IHBhdGggb250byB0aGUgdG9rZW5zLlxuICAgIGlmIChwYXRoKSB7XG4gICAgICB0b2tlbnMucHVzaChwYXRoKVxuICAgICAgcGF0aCA9ICcnXG4gICAgfVxuXG4gICAgdmFyIHByZWZpeCA9IHJlc1syXVxuICAgIHZhciBuYW1lID0gcmVzWzNdXG4gICAgdmFyIGNhcHR1cmUgPSByZXNbNF1cbiAgICB2YXIgZ3JvdXAgPSByZXNbNV1cbiAgICB2YXIgc3VmZml4ID0gcmVzWzZdXG4gICAgdmFyIGFzdGVyaXNrID0gcmVzWzddXG5cbiAgICB2YXIgcmVwZWF0ID0gc3VmZml4ID09PSAnKycgfHwgc3VmZml4ID09PSAnKidcbiAgICB2YXIgb3B0aW9uYWwgPSBzdWZmaXggPT09ICc/JyB8fCBzdWZmaXggPT09ICcqJ1xuICAgIHZhciBkZWxpbWl0ZXIgPSBwcmVmaXggfHwgJy8nXG4gICAgdmFyIHBhdHRlcm4gPSBjYXB0dXJlIHx8IGdyb3VwIHx8IChhc3RlcmlzayA/ICcuKicgOiAnW14nICsgZGVsaW1pdGVyICsgJ10rPycpXG5cbiAgICB0b2tlbnMucHVzaCh7XG4gICAgICBuYW1lOiBuYW1lIHx8IGtleSsrLFxuICAgICAgcHJlZml4OiBwcmVmaXggfHwgJycsXG4gICAgICBkZWxpbWl0ZXI6IGRlbGltaXRlcixcbiAgICAgIG9wdGlvbmFsOiBvcHRpb25hbCxcbiAgICAgIHJlcGVhdDogcmVwZWF0LFxuICAgICAgcGF0dGVybjogZXNjYXBlR3JvdXAocGF0dGVybilcbiAgICB9KVxuICB9XG5cbiAgLy8gTWF0Y2ggYW55IGNoYXJhY3RlcnMgc3RpbGwgcmVtYWluaW5nLlxuICBpZiAoaW5kZXggPCBzdHIubGVuZ3RoKSB7XG4gICAgcGF0aCArPSBzdHIuc3Vic3RyKGluZGV4KVxuICB9XG5cbiAgLy8gSWYgdGhlIHBhdGggZXhpc3RzLCBwdXNoIGl0IG9udG8gdGhlIGVuZC5cbiAgaWYgKHBhdGgpIHtcbiAgICB0b2tlbnMucHVzaChwYXRoKVxuICB9XG5cbiAgcmV0dXJuIHRva2Vuc1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBzdHJpbmcgdG8gYSB0ZW1wbGF0ZSBmdW5jdGlvbiBmb3IgdGhlIHBhdGguXG4gKlxuICogQHBhcmFtICB7U3RyaW5nfSAgIHN0clxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cbmZ1bmN0aW9uIGNvbXBpbGUgKHN0cikge1xuICByZXR1cm4gdG9rZW5zVG9GdW5jdGlvbihwYXJzZShzdHIpKVxufVxuXG4vKipcbiAqIEV4cG9zZSBhIG1ldGhvZCBmb3IgdHJhbnNmb3JtaW5nIHRva2VucyBpbnRvIHRoZSBwYXRoIGZ1bmN0aW9uLlxuICovXG5mdW5jdGlvbiB0b2tlbnNUb0Z1bmN0aW9uICh0b2tlbnMpIHtcbiAgLy8gQ29tcGlsZSBhbGwgdGhlIHRva2VucyBpbnRvIHJlZ2V4cHMuXG4gIHZhciBtYXRjaGVzID0gbmV3IEFycmF5KHRva2Vucy5sZW5ndGgpXG5cbiAgLy8gQ29tcGlsZSBhbGwgdGhlIHBhdHRlcm5zIGJlZm9yZSBjb21waWxhdGlvbi5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodHlwZW9mIHRva2Vuc1tpXSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIG1hdGNoZXNbaV0gPSBuZXcgUmVnRXhwKCdeJyArIHRva2Vuc1tpXS5wYXR0ZXJuICsgJyQnKVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBmdW5jdGlvbiAob2JqKSB7XG4gICAgdmFyIHBhdGggPSAnJ1xuICAgIHZhciBkYXRhID0gb2JqIHx8IHt9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIHRva2VuID0gdG9rZW5zW2ldXG5cbiAgICAgIGlmICh0eXBlb2YgdG9rZW4gPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHBhdGggKz0gdG9rZW5cblxuICAgICAgICBjb250aW51ZVxuICAgICAgfVxuXG4gICAgICB2YXIgdmFsdWUgPSBkYXRhW3Rva2VuLm5hbWVdXG4gICAgICB2YXIgc2VnbWVudFxuXG4gICAgICBpZiAodmFsdWUgPT0gbnVsbCkge1xuICAgICAgICBpZiAodG9rZW4ub3B0aW9uYWwpIHtcbiAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIFwiJyArIHRva2VuLm5hbWUgKyAnXCIgdG8gYmUgZGVmaW5lZCcpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGlzYXJyYXkodmFsdWUpKSB7XG4gICAgICAgIGlmICghdG9rZW4ucmVwZWF0KSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgXCInICsgdG9rZW4ubmFtZSArICdcIiB0byBub3QgcmVwZWF0LCBidXQgcmVjZWl2ZWQgXCInICsgdmFsdWUgKyAnXCInKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHZhbHVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIGlmICh0b2tlbi5vcHRpb25hbCkge1xuICAgICAgICAgICAgY29udGludWVcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignRXhwZWN0ZWQgXCInICsgdG9rZW4ubmFtZSArICdcIiB0byBub3QgYmUgZW1wdHknKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDwgdmFsdWUubGVuZ3RoOyBqKyspIHtcbiAgICAgICAgICBzZWdtZW50ID0gZW5jb2RlVVJJQ29tcG9uZW50KHZhbHVlW2pdKVxuXG4gICAgICAgICAgaWYgKCFtYXRjaGVzW2ldLnRlc3Qoc2VnbWVudCkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIGFsbCBcIicgKyB0b2tlbi5uYW1lICsgJ1wiIHRvIG1hdGNoIFwiJyArIHRva2VuLnBhdHRlcm4gKyAnXCIsIGJ1dCByZWNlaXZlZCBcIicgKyBzZWdtZW50ICsgJ1wiJylcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBwYXRoICs9IChqID09PSAwID8gdG9rZW4ucHJlZml4IDogdG9rZW4uZGVsaW1pdGVyKSArIHNlZ21lbnRcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG5cbiAgICAgIHNlZ21lbnQgPSBlbmNvZGVVUklDb21wb25lbnQodmFsdWUpXG5cbiAgICAgIGlmICghbWF0Y2hlc1tpXS50ZXN0KHNlZ21lbnQpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0V4cGVjdGVkIFwiJyArIHRva2VuLm5hbWUgKyAnXCIgdG8gbWF0Y2ggXCInICsgdG9rZW4ucGF0dGVybiArICdcIiwgYnV0IHJlY2VpdmVkIFwiJyArIHNlZ21lbnQgKyAnXCInKVxuICAgICAgfVxuXG4gICAgICBwYXRoICs9IHRva2VuLnByZWZpeCArIHNlZ21lbnRcbiAgICB9XG5cbiAgICByZXR1cm4gcGF0aFxuICB9XG59XG5cbi8qKlxuICogRXNjYXBlIGEgcmVndWxhciBleHByZXNzaW9uIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0gIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5mdW5jdGlvbiBlc2NhcGVTdHJpbmcgKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoLyhbLisqPz1eIToke30oKVtcXF18XFwvXSkvZywgJ1xcXFwkMScpXG59XG5cbi8qKlxuICogRXNjYXBlIHRoZSBjYXB0dXJpbmcgZ3JvdXAgYnkgZXNjYXBpbmcgc3BlY2lhbCBjaGFyYWN0ZXJzIGFuZCBtZWFuaW5nLlxuICpcbiAqIEBwYXJhbSAge1N0cmluZ30gZ3JvdXBcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuZnVuY3Rpb24gZXNjYXBlR3JvdXAgKGdyb3VwKSB7XG4gIHJldHVybiBncm91cC5yZXBsYWNlKC8oWz0hOiRcXC8oKV0pL2csICdcXFxcJDEnKVxufVxuXG4vKipcbiAqIEF0dGFjaCB0aGUga2V5cyBhcyBhIHByb3BlcnR5IG9mIHRoZSByZWdleHAuXG4gKlxuICogQHBhcmFtICB7UmVnRXhwfSByZVxuICogQHBhcmFtICB7QXJyYXl9ICBrZXlzXG4gKiBAcmV0dXJuIHtSZWdFeHB9XG4gKi9cbmZ1bmN0aW9uIGF0dGFjaEtleXMgKHJlLCBrZXlzKSB7XG4gIHJlLmtleXMgPSBrZXlzXG4gIHJldHVybiByZVxufVxuXG4vKipcbiAqIEdldCB0aGUgZmxhZ3MgZm9yIGEgcmVnZXhwIGZyb20gdGhlIG9wdGlvbnMuXG4gKlxuICogQHBhcmFtICB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmZ1bmN0aW9uIGZsYWdzIChvcHRpb25zKSB7XG4gIHJldHVybiBvcHRpb25zLnNlbnNpdGl2ZSA/ICcnIDogJ2knXG59XG5cbi8qKlxuICogUHVsbCBvdXQga2V5cyBmcm9tIGEgcmVnZXhwLlxuICpcbiAqIEBwYXJhbSAge1JlZ0V4cH0gcGF0aFxuICogQHBhcmFtICB7QXJyYXl9ICBrZXlzXG4gKiBAcmV0dXJuIHtSZWdFeHB9XG4gKi9cbmZ1bmN0aW9uIHJlZ2V4cFRvUmVnZXhwIChwYXRoLCBrZXlzKSB7XG4gIC8vIFVzZSBhIG5lZ2F0aXZlIGxvb2thaGVhZCB0byBtYXRjaCBvbmx5IGNhcHR1cmluZyBncm91cHMuXG4gIHZhciBncm91cHMgPSBwYXRoLnNvdXJjZS5tYXRjaCgvXFwoKD8hXFw/KS9nKVxuXG4gIGlmIChncm91cHMpIHtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGdyb3Vwcy5sZW5ndGg7IGkrKykge1xuICAgICAga2V5cy5wdXNoKHtcbiAgICAgICAgbmFtZTogaSxcbiAgICAgICAgcHJlZml4OiBudWxsLFxuICAgICAgICBkZWxpbWl0ZXI6IG51bGwsXG4gICAgICAgIG9wdGlvbmFsOiBmYWxzZSxcbiAgICAgICAgcmVwZWF0OiBmYWxzZSxcbiAgICAgICAgcGF0dGVybjogbnVsbFxuICAgICAgfSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYXR0YWNoS2V5cyhwYXRoLCBrZXlzKVxufVxuXG4vKipcbiAqIFRyYW5zZm9ybSBhbiBhcnJheSBpbnRvIGEgcmVnZXhwLlxuICpcbiAqIEBwYXJhbSAge0FycmF5fSAgcGF0aFxuICogQHBhcmFtICB7QXJyYXl9ICBrZXlzXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1JlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gYXJyYXlUb1JlZ2V4cCAocGF0aCwga2V5cywgb3B0aW9ucykge1xuICB2YXIgcGFydHMgPSBbXVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcGF0aC5sZW5ndGg7IGkrKykge1xuICAgIHBhcnRzLnB1c2gocGF0aFRvUmVnZXhwKHBhdGhbaV0sIGtleXMsIG9wdGlvbnMpLnNvdXJjZSlcbiAgfVxuXG4gIHZhciByZWdleHAgPSBuZXcgUmVnRXhwKCcoPzonICsgcGFydHMuam9pbignfCcpICsgJyknLCBmbGFncyhvcHRpb25zKSlcblxuICByZXR1cm4gYXR0YWNoS2V5cyhyZWdleHAsIGtleXMpXG59XG5cbi8qKlxuICogQ3JlYXRlIGEgcGF0aCByZWdleHAgZnJvbSBzdHJpbmcgaW5wdXQuXG4gKlxuICogQHBhcmFtICB7U3RyaW5nfSBwYXRoXG4gKiBAcGFyYW0gIHtBcnJheX0gIGtleXNcbiAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7UmVnRXhwfVxuICovXG5mdW5jdGlvbiBzdHJpbmdUb1JlZ2V4cCAocGF0aCwga2V5cywgb3B0aW9ucykge1xuICB2YXIgdG9rZW5zID0gcGFyc2UocGF0aClcbiAgdmFyIHJlID0gdG9rZW5zVG9SZWdFeHAodG9rZW5zLCBvcHRpb25zKVxuXG4gIC8vIEF0dGFjaCBrZXlzIGJhY2sgdG8gdGhlIHJlZ2V4cC5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAodHlwZW9mIHRva2Vuc1tpXSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIGtleXMucHVzaCh0b2tlbnNbaV0pXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGF0dGFjaEtleXMocmUsIGtleXMpXG59XG5cbi8qKlxuICogRXhwb3NlIGEgZnVuY3Rpb24gZm9yIHRha2luZyB0b2tlbnMgYW5kIHJldHVybmluZyBhIFJlZ0V4cC5cbiAqXG4gKiBAcGFyYW0gIHtBcnJheX0gIHRva2Vuc1xuICogQHBhcmFtICB7QXJyYXl9ICBrZXlzXG4gKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge1JlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gdG9rZW5zVG9SZWdFeHAgKHRva2Vucywgb3B0aW9ucykge1xuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuXG4gIHZhciBzdHJpY3QgPSBvcHRpb25zLnN0cmljdFxuICB2YXIgZW5kID0gb3B0aW9ucy5lbmQgIT09IGZhbHNlXG4gIHZhciByb3V0ZSA9ICcnXG4gIHZhciBsYXN0VG9rZW4gPSB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdXG4gIHZhciBlbmRzV2l0aFNsYXNoID0gdHlwZW9mIGxhc3RUb2tlbiA9PT0gJ3N0cmluZycgJiYgL1xcLyQvLnRlc3QobGFzdFRva2VuKVxuXG4gIC8vIEl0ZXJhdGUgb3ZlciB0aGUgdG9rZW5zIGFuZCBjcmVhdGUgb3VyIHJlZ2V4cCBzdHJpbmcuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIHRva2VuID0gdG9rZW5zW2ldXG5cbiAgICBpZiAodHlwZW9mIHRva2VuID09PSAnc3RyaW5nJykge1xuICAgICAgcm91dGUgKz0gZXNjYXBlU3RyaW5nKHRva2VuKVxuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcHJlZml4ID0gZXNjYXBlU3RyaW5nKHRva2VuLnByZWZpeClcbiAgICAgIHZhciBjYXB0dXJlID0gdG9rZW4ucGF0dGVyblxuXG4gICAgICBpZiAodG9rZW4ucmVwZWF0KSB7XG4gICAgICAgIGNhcHR1cmUgKz0gJyg/OicgKyBwcmVmaXggKyBjYXB0dXJlICsgJykqJ1xuICAgICAgfVxuXG4gICAgICBpZiAodG9rZW4ub3B0aW9uYWwpIHtcbiAgICAgICAgaWYgKHByZWZpeCkge1xuICAgICAgICAgIGNhcHR1cmUgPSAnKD86JyArIHByZWZpeCArICcoJyArIGNhcHR1cmUgKyAnKSk/J1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNhcHR1cmUgPSAnKCcgKyBjYXB0dXJlICsgJyk/J1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjYXB0dXJlID0gcHJlZml4ICsgJygnICsgY2FwdHVyZSArICcpJ1xuICAgICAgfVxuXG4gICAgICByb3V0ZSArPSBjYXB0dXJlXG4gICAgfVxuICB9XG5cbiAgLy8gSW4gbm9uLXN0cmljdCBtb2RlIHdlIGFsbG93IGEgc2xhc2ggYXQgdGhlIGVuZCBvZiBtYXRjaC4gSWYgdGhlIHBhdGggdG9cbiAgLy8gbWF0Y2ggYWxyZWFkeSBlbmRzIHdpdGggYSBzbGFzaCwgd2UgcmVtb3ZlIGl0IGZvciBjb25zaXN0ZW5jeS4gVGhlIHNsYXNoXG4gIC8vIGlzIHZhbGlkIGF0IHRoZSBlbmQgb2YgYSBwYXRoIG1hdGNoLCBub3QgaW4gdGhlIG1pZGRsZS4gVGhpcyBpcyBpbXBvcnRhbnRcbiAgLy8gaW4gbm9uLWVuZGluZyBtb2RlLCB3aGVyZSBcIi90ZXN0L1wiIHNob3VsZG4ndCBtYXRjaCBcIi90ZXN0Ly9yb3V0ZVwiLlxuICBpZiAoIXN0cmljdCkge1xuICAgIHJvdXRlID0gKGVuZHNXaXRoU2xhc2ggPyByb3V0ZS5zbGljZSgwLCAtMikgOiByb3V0ZSkgKyAnKD86XFxcXC8oPz0kKSk/J1xuICB9XG5cbiAgaWYgKGVuZCkge1xuICAgIHJvdXRlICs9ICckJ1xuICB9IGVsc2Uge1xuICAgIC8vIEluIG5vbi1lbmRpbmcgbW9kZSwgd2UgbmVlZCB0aGUgY2FwdHVyaW5nIGdyb3VwcyB0byBtYXRjaCBhcyBtdWNoIGFzXG4gICAgLy8gcG9zc2libGUgYnkgdXNpbmcgYSBwb3NpdGl2ZSBsb29rYWhlYWQgdG8gdGhlIGVuZCBvciBuZXh0IHBhdGggc2VnbWVudC5cbiAgICByb3V0ZSArPSBzdHJpY3QgJiYgZW5kc1dpdGhTbGFzaCA/ICcnIDogJyg/PVxcXFwvfCQpJ1xuICB9XG5cbiAgcmV0dXJuIG5ldyBSZWdFeHAoJ14nICsgcm91dGUsIGZsYWdzKG9wdGlvbnMpKVxufVxuXG4vKipcbiAqIE5vcm1hbGl6ZSB0aGUgZ2l2ZW4gcGF0aCBzdHJpbmcsIHJldHVybmluZyBhIHJlZ3VsYXIgZXhwcmVzc2lvbi5cbiAqXG4gKiBBbiBlbXB0eSBhcnJheSBjYW4gYmUgcGFzc2VkIGluIGZvciB0aGUga2V5cywgd2hpY2ggd2lsbCBob2xkIHRoZVxuICogcGxhY2Vob2xkZXIga2V5IGRlc2NyaXB0aW9ucy4gRm9yIGV4YW1wbGUsIHVzaW5nIGAvdXNlci86aWRgLCBga2V5c2Agd2lsbFxuICogY29udGFpbiBgW3sgbmFtZTogJ2lkJywgZGVsaW1pdGVyOiAnLycsIG9wdGlvbmFsOiBmYWxzZSwgcmVwZWF0OiBmYWxzZSB9XWAuXG4gKlxuICogQHBhcmFtICB7KFN0cmluZ3xSZWdFeHB8QXJyYXkpfSBwYXRoXG4gKiBAcGFyYW0gIHtBcnJheX0gICAgICAgICAgICAgICAgIFtrZXlzXVxuICogQHBhcmFtICB7T2JqZWN0fSAgICAgICAgICAgICAgICBbb3B0aW9uc11cbiAqIEByZXR1cm4ge1JlZ0V4cH1cbiAqL1xuZnVuY3Rpb24gcGF0aFRvUmVnZXhwIChwYXRoLCBrZXlzLCBvcHRpb25zKSB7XG4gIGtleXMgPSBrZXlzIHx8IFtdXG5cbiAgaWYgKCFpc2FycmF5KGtleXMpKSB7XG4gICAgb3B0aW9ucyA9IGtleXNcbiAgICBrZXlzID0gW11cbiAgfSBlbHNlIGlmICghb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSB7fVxuICB9XG5cbiAgaWYgKHBhdGggaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICByZXR1cm4gcmVnZXhwVG9SZWdleHAocGF0aCwga2V5cywgb3B0aW9ucylcbiAgfVxuXG4gIGlmIChpc2FycmF5KHBhdGgpKSB7XG4gICAgcmV0dXJuIGFycmF5VG9SZWdleHAocGF0aCwga2V5cywgb3B0aW9ucylcbiAgfVxuXG4gIHJldHVybiBzdHJpbmdUb1JlZ2V4cChwYXRoLCBrZXlzLCBvcHRpb25zKVxufVxuIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbi8vIGNhY2hlZCBmcm9tIHdoYXRldmVyIGdsb2JhbCBpcyBwcmVzZW50IHNvIHRoYXQgdGVzdCBydW5uZXJzIHRoYXQgc3R1YiBpdFxuLy8gZG9uJ3QgYnJlYWsgdGhpbmdzLiAgQnV0IHdlIG5lZWQgdG8gd3JhcCBpdCBpbiBhIHRyeSBjYXRjaCBpbiBjYXNlIGl0IGlzXG4vLyB3cmFwcGVkIGluIHN0cmljdCBtb2RlIGNvZGUgd2hpY2ggZG9lc24ndCBkZWZpbmUgYW55IGdsb2JhbHMuICBJdCdzIGluc2lkZSBhXG4vLyBmdW5jdGlvbiBiZWNhdXNlIHRyeS9jYXRjaGVzIGRlb3B0aW1pemUgaW4gY2VydGFpbiBlbmdpbmVzLlxuXG52YXIgY2FjaGVkU2V0VGltZW91dDtcbnZhciBjYWNoZWRDbGVhclRpbWVvdXQ7XG5cbmZ1bmN0aW9uIGRlZmF1bHRTZXRUaW1vdXQoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdzZXRUaW1lb3V0IGhhcyBub3QgYmVlbiBkZWZpbmVkJyk7XG59XG5mdW5jdGlvbiBkZWZhdWx0Q2xlYXJUaW1lb3V0ICgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2NsZWFyVGltZW91dCBoYXMgbm90IGJlZW4gZGVmaW5lZCcpO1xufVxuKGZ1bmN0aW9uICgpIHtcbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIHNldFRpbWVvdXQgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBzZXRUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IGRlZmF1bHRTZXRUaW1vdXQ7XG4gICAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNhY2hlZFNldFRpbWVvdXQgPSBkZWZhdWx0U2V0VGltb3V0O1xuICAgIH1cbiAgICB0cnkge1xuICAgICAgICBpZiAodHlwZW9mIGNsZWFyVGltZW91dCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gY2xlYXJUaW1lb3V0O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICAgICAgfVxuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgY2FjaGVkQ2xlYXJUaW1lb3V0ID0gZGVmYXVsdENsZWFyVGltZW91dDtcbiAgICB9XG59ICgpKVxuZnVuY3Rpb24gcnVuVGltZW91dChmdW4pIHtcbiAgICBpZiAoY2FjaGVkU2V0VGltZW91dCA9PT0gc2V0VGltZW91dCkge1xuICAgICAgICAvL25vcm1hbCBlbnZpcm9tZW50cyBpbiBzYW5lIHNpdHVhdGlvbnNcbiAgICAgICAgcmV0dXJuIHNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9XG4gICAgLy8gaWYgc2V0VGltZW91dCB3YXNuJ3QgYXZhaWxhYmxlIGJ1dCB3YXMgbGF0dGVyIGRlZmluZWRcbiAgICBpZiAoKGNhY2hlZFNldFRpbWVvdXQgPT09IGRlZmF1bHRTZXRUaW1vdXQgfHwgIWNhY2hlZFNldFRpbWVvdXQpICYmIHNldFRpbWVvdXQpIHtcbiAgICAgICAgY2FjaGVkU2V0VGltZW91dCA9IHNldFRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBzZXRUaW1lb3V0KGZ1biwgMCk7XG4gICAgfVxuICAgIHRyeSB7XG4gICAgICAgIC8vIHdoZW4gd2hlbiBzb21lYm9keSBoYXMgc2NyZXdlZCB3aXRoIHNldFRpbWVvdXQgYnV0IG5vIEkuRS4gbWFkZG5lc3NcbiAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQoZnVuLCAwKTtcbiAgICB9IGNhdGNoKGUpe1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgLy8gV2hlbiB3ZSBhcmUgaW4gSS5FLiBidXQgdGhlIHNjcmlwdCBoYXMgYmVlbiBldmFsZWQgc28gSS5FLiBkb2Vzbid0IHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkU2V0VGltZW91dC5jYWxsKG51bGwsIGZ1biwgMCk7XG4gICAgICAgIH0gY2F0Y2goZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvclxuICAgICAgICAgICAgcmV0dXJuIGNhY2hlZFNldFRpbWVvdXQuY2FsbCh0aGlzLCBmdW4sIDApO1xuICAgICAgICB9XG4gICAgfVxuXG5cbn1cbmZ1bmN0aW9uIHJ1bkNsZWFyVGltZW91dChtYXJrZXIpIHtcbiAgICBpZiAoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBjbGVhclRpbWVvdXQpIHtcbiAgICAgICAgLy9ub3JtYWwgZW52aXJvbWVudHMgaW4gc2FuZSBzaXR1YXRpb25zXG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgLy8gaWYgY2xlYXJUaW1lb3V0IHdhc24ndCBhdmFpbGFibGUgYnV0IHdhcyBsYXR0ZXIgZGVmaW5lZFxuICAgIGlmICgoY2FjaGVkQ2xlYXJUaW1lb3V0ID09PSBkZWZhdWx0Q2xlYXJUaW1lb3V0IHx8ICFjYWNoZWRDbGVhclRpbWVvdXQpICYmIGNsZWFyVGltZW91dCkge1xuICAgICAgICBjYWNoZWRDbGVhclRpbWVvdXQgPSBjbGVhclRpbWVvdXQ7XG4gICAgICAgIHJldHVybiBjbGVhclRpbWVvdXQobWFya2VyKTtcbiAgICB9XG4gICAgdHJ5IHtcbiAgICAgICAgLy8gd2hlbiB3aGVuIHNvbWVib2R5IGhhcyBzY3Jld2VkIHdpdGggc2V0VGltZW91dCBidXQgbm8gSS5FLiBtYWRkbmVzc1xuICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0KG1hcmtlcik7XG4gICAgfSBjYXRjaCAoZSl7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICAvLyBXaGVuIHdlIGFyZSBpbiBJLkUuIGJ1dCB0aGUgc2NyaXB0IGhhcyBiZWVuIGV2YWxlZCBzbyBJLkUuIGRvZXNuJ3QgIHRydXN0IHRoZSBnbG9iYWwgb2JqZWN0IHdoZW4gY2FsbGVkIG5vcm1hbGx5XG4gICAgICAgICAgICByZXR1cm4gY2FjaGVkQ2xlYXJUaW1lb3V0LmNhbGwobnVsbCwgbWFya2VyKTtcbiAgICAgICAgfSBjYXRjaCAoZSl7XG4gICAgICAgICAgICAvLyBzYW1lIGFzIGFib3ZlIGJ1dCB3aGVuIGl0J3MgYSB2ZXJzaW9uIG9mIEkuRS4gdGhhdCBtdXN0IGhhdmUgdGhlIGdsb2JhbCBvYmplY3QgZm9yICd0aGlzJywgaG9wZnVsbHkgb3VyIGNvbnRleHQgY29ycmVjdCBvdGhlcndpc2UgaXQgd2lsbCB0aHJvdyBhIGdsb2JhbCBlcnJvci5cbiAgICAgICAgICAgIC8vIFNvbWUgdmVyc2lvbnMgb2YgSS5FLiBoYXZlIGRpZmZlcmVudCBydWxlcyBmb3IgY2xlYXJUaW1lb3V0IHZzIHNldFRpbWVvdXRcbiAgICAgICAgICAgIHJldHVybiBjYWNoZWRDbGVhclRpbWVvdXQuY2FsbCh0aGlzLCBtYXJrZXIpO1xuICAgICAgICB9XG4gICAgfVxuXG5cblxufVxudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gcnVuVGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgcnVuQ2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgcnVuVGltZW91dChkcmFpblF1ZXVlKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kTGlzdGVuZXIgPSBub29wO1xucHJvY2Vzcy5wcmVwZW5kT25jZUxpc3RlbmVyID0gbm9vcDtcblxucHJvY2Vzcy5saXN0ZW5lcnMgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gW10gfVxuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsIi8qKlxuICogQ29udmVydCBhcnJheSBvZiAxNiBieXRlIHZhbHVlcyB0byBVVUlEIHN0cmluZyBmb3JtYXQgb2YgdGhlIGZvcm06XG4gKiBYWFhYWFhYWC1YWFhYLVhYWFgtWFhYWC1YWFhYWFhYWFhYWFhcbiAqL1xudmFyIGJ5dGVUb0hleCA9IFtdO1xuZm9yICh2YXIgaSA9IDA7IGkgPCAyNTY7ICsraSkge1xuICBieXRlVG9IZXhbaV0gPSAoaSArIDB4MTAwKS50b1N0cmluZygxNikuc3Vic3RyKDEpO1xufVxuXG5mdW5jdGlvbiBieXRlc1RvVXVpZChidWYsIG9mZnNldCkge1xuICB2YXIgaSA9IG9mZnNldCB8fCAwO1xuICB2YXIgYnRoID0gYnl0ZVRvSGV4O1xuICByZXR1cm4gYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dICsgJy0nICtcbiAgICAgICAgICBidGhbYnVmW2krK11dICsgYnRoW2J1ZltpKytdXSArICctJyArXG4gICAgICAgICAgYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gKyAnLScgK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dICsgJy0nICtcbiAgICAgICAgICBidGhbYnVmW2krK11dICsgYnRoW2J1ZltpKytdXSArXG4gICAgICAgICAgYnRoW2J1ZltpKytdXSArIGJ0aFtidWZbaSsrXV0gK1xuICAgICAgICAgIGJ0aFtidWZbaSsrXV0gKyBidGhbYnVmW2krK11dO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGJ5dGVzVG9VdWlkO1xuIiwiLy8gVW5pcXVlIElEIGNyZWF0aW9uIHJlcXVpcmVzIGEgaGlnaCBxdWFsaXR5IHJhbmRvbSAjIGdlbmVyYXRvci4gIEluIHRoZVxuLy8gYnJvd3NlciB0aGlzIGlzIGEgbGl0dGxlIGNvbXBsaWNhdGVkIGR1ZSB0byB1bmtub3duIHF1YWxpdHkgb2YgTWF0aC5yYW5kb20oKVxuLy8gYW5kIGluY29uc2lzdGVudCBzdXBwb3J0IGZvciB0aGUgYGNyeXB0b2AgQVBJLiAgV2UgZG8gdGhlIGJlc3Qgd2UgY2FuIHZpYVxuLy8gZmVhdHVyZS1kZXRlY3Rpb25cbnZhciBybmc7XG5cbnZhciBjcnlwdG8gPSBnbG9iYWwuY3J5cHRvIHx8IGdsb2JhbC5tc0NyeXB0bzsgLy8gZm9yIElFIDExXG5pZiAoY3J5cHRvICYmIGNyeXB0by5nZXRSYW5kb21WYWx1ZXMpIHtcbiAgLy8gV0hBVFdHIGNyeXB0byBSTkcgLSBodHRwOi8vd2lraS53aGF0d2cub3JnL3dpa2kvQ3J5cHRvXG4gIHZhciBybmRzOCA9IG5ldyBVaW50OEFycmF5KDE2KTsgLy8gZXNsaW50LWRpc2FibGUtbGluZSBuby11bmRlZlxuICBybmcgPSBmdW5jdGlvbiB3aGF0d2dSTkcoKSB7XG4gICAgY3J5cHRvLmdldFJhbmRvbVZhbHVlcyhybmRzOCk7XG4gICAgcmV0dXJuIHJuZHM4O1xuICB9O1xufVxuXG5pZiAoIXJuZykge1xuICAvLyBNYXRoLnJhbmRvbSgpLWJhc2VkIChSTkcpXG4gIC8vXG4gIC8vIElmIGFsbCBlbHNlIGZhaWxzLCB1c2UgTWF0aC5yYW5kb20oKS4gIEl0J3MgZmFzdCwgYnV0IGlzIG9mIHVuc3BlY2lmaWVkXG4gIC8vIHF1YWxpdHkuXG4gIHZhciBybmRzID0gbmV3IEFycmF5KDE2KTtcbiAgcm5nID0gZnVuY3Rpb24oKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIHI7IGkgPCAxNjsgaSsrKSB7XG4gICAgICBpZiAoKGkgJiAweDAzKSA9PT0gMCkgciA9IE1hdGgucmFuZG9tKCkgKiAweDEwMDAwMDAwMDtcbiAgICAgIHJuZHNbaV0gPSByID4+PiAoKGkgJiAweDAzKSA8PCAzKSAmIDB4ZmY7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJuZHM7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcm5nO1xuIiwidmFyIHJuZyA9IHJlcXVpcmUoJy4vbGliL3JuZycpO1xudmFyIGJ5dGVzVG9VdWlkID0gcmVxdWlyZSgnLi9saWIvYnl0ZXNUb1V1aWQnKTtcblxuZnVuY3Rpb24gdjQob3B0aW9ucywgYnVmLCBvZmZzZXQpIHtcbiAgdmFyIGkgPSBidWYgJiYgb2Zmc2V0IHx8IDA7XG5cbiAgaWYgKHR5cGVvZihvcHRpb25zKSA9PSAnc3RyaW5nJykge1xuICAgIGJ1ZiA9IG9wdGlvbnMgPT0gJ2JpbmFyeScgPyBuZXcgQXJyYXkoMTYpIDogbnVsbDtcbiAgICBvcHRpb25zID0gbnVsbDtcbiAgfVxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICB2YXIgcm5kcyA9IG9wdGlvbnMucmFuZG9tIHx8IChvcHRpb25zLnJuZyB8fCBybmcpKCk7XG5cbiAgLy8gUGVyIDQuNCwgc2V0IGJpdHMgZm9yIHZlcnNpb24gYW5kIGBjbG9ja19zZXFfaGlfYW5kX3Jlc2VydmVkYFxuICBybmRzWzZdID0gKHJuZHNbNl0gJiAweDBmKSB8IDB4NDA7XG4gIHJuZHNbOF0gPSAocm5kc1s4XSAmIDB4M2YpIHwgMHg4MDtcblxuICAvLyBDb3B5IGJ5dGVzIHRvIGJ1ZmZlciwgaWYgcHJvdmlkZWRcbiAgaWYgKGJ1Zikge1xuICAgIGZvciAodmFyIGlpID0gMDsgaWkgPCAxNjsgKytpaSkge1xuICAgICAgYnVmW2kgKyBpaV0gPSBybmRzW2lpXTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gYnVmIHx8IGJ5dGVzVG9VdWlkKHJuZHMpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHY0O1xuIiwiaW1wb3J0IHJlcGxhY2VBbGwgZnJvbSAnLi9VdGlscy9TdHJpbmdSZXBsYWNlcidcblxuLy8gZ2V0IHRlbXBsYXRlIGZvciBlYWNoIGRlY2lzaW9uIGFuZCBkaXNwbGF5IGl0XG5jb25zdCBjcmVhdGVEZWNpc2lvbkNhcmQgPSAoZGljZSwgY29tcG9uZW50KSA9PiB7XG4gIGNvbnNvbGUubG9nKCdjcmVhdGVEZWNpc2lvbkNhcmQgd2FzIGNhbGxlZCcpO1xuICBjb25zdCBtYXAgPSB7XG4gICAgJ0B0aXRsZSc6IGRpY2UuZGVjaXNpb24sXG4gICAgJ0BpZCc6IGRpY2UuX2lkLFxuICAgICdAZGVzY3JpcHRpb24nOiAndG8gYmUgZGV0ZXJtaW5lZCdcbiAgfVxuICBjb25zdCBjYXJkID0gcmVwbGFjZUFsbChjb21wb25lbnQsIG1hcCk7XG4gICQoJy5qcy1tYWluLWNvbnRlbnQnKS5hcHBlbmQoY2FyZCk7XG4gICQoJy5qcy1yb2xsJykuY2xpY2soKGUpID0+IHtcbiAgICBlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuICAgIGRpY2Uucm9sbCgpLnRoZW4ocmVzdWx0ID0+IGFsZXJ0KHJlc3VsdC5jb250ZW50KSk7XG4gIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQge2NyZWF0ZURlY2lzaW9uQ2FyZH1cbiIsImltcG9ydCByZXBsYWNlQWxsIGZyb20gJy4vVXRpbHMvU3RyaW5nUmVwbGFjZXInXG5jb25zdCB1dWlkdjQgPSByZXF1aXJlKCd1dWlkL3Y0Jyk7XG5cbmNvbnN0IGNyZWF0ZURpY2VFZGl0UGFnZSA9IGZ1bmN0aW9uKGRpY2UsIHBhZ2VMYXlvdXQsIGRpY2VIZWFkZXJDb21wb25lbnQsIG9wdGlvbkNvbXBvbmVudCkge1xuICBjb25zb2xlLmxvZygnY3JlYXRlRGljZUVkaXRQYWdlIHdhcyBjYWxsZWQnKTtcbiAgY29uc3QgZGljZU1hcCA9IHtcbiAgICAnQHRpdGxlJzogZGljZS5kZWNpc2lvbixcbiAgICAnQGRlc2NyaXB0aW9uJzogJ3RvIGJlIGRldGVybWluZWQnXG4gIH1cbiAgY29uc3QgZGljZUhlYWRlciA9IHJlcGxhY2VBbGwoZGljZUhlYWRlckNvbXBvbmVudCwgZGljZU1hcCk7XG4gICQoJy5qcy1tYWluLWNvbnRlbnQnKS5hcHBlbmQocGFnZUxheW91dCk7XG4gICQoJy5qcy1lZGl0LWRlY2lzaW9uLWZhY2UnKS5hcHBlbmQoZGljZUhlYWRlcik7XG5cbiAgZGljZS5vcHRpb25zLmZvckVhY2gob3B0aW9uID0+IHtcbiAgICAkKCcuanMtZWRpdC1vcHRpb25zLWxpc3QnKS5hcHBlbmQocmVwbGFjZUFsbChvcHRpb25Db21wb25lbnQsIHsnQG9wdGlvbic6IG9wdGlvbi5jb250ZW50fSkpO1xuICAgICQoJy5qcy1kZWxldGUtb3B0aW9uJykub24oXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICAgICQoZS5jdXJyZW50VGFyZ2V0KS5wYXJlbnQoKS5yZW1vdmUoKTtcbiAgICAgIGRpY2UuZGVsZXRlT3B0aW9uKG9wdGlvbi5mYWNlKVxuXG4gICAgICBjb25zb2xlLmxvZygnb3B0aW9uIGhhcyBiZWVuIGRlbGV0ZWQnKTtcbiAgICAgIGNvbnNvbGUubG9nKGRpY2Uub3B0aW9ucyk7XG4gICAgfSk7XG4gIH0pXG5cbiAgJCgnLmpzLWFkZC1vcHRpb24nKS5mb2N1cygoKSA9PiB7XG4gICAgaWYgKCEkKCcuanMtb3B0aW9uLXRleHQnKS52YWwoKS5yZXBsYWNlKC9cXHMvZywgJycpLmxlbmd0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBuZXdJZCA9IHV1aWR2NCgpO1xuICAgIGNvbnN0IG5ld09wdGlvbiA9ICQoJy5qcy1vcHRpb24tdGV4dCcpLnZhbCgpO1xuXG4gICAgJCgnLmpzLWVkaXQtb3B0aW9ucy1saXN0JykuYXBwZW5kKHJlcGxhY2VBbGwob3B0aW9uQ29tcG9uZW50LCB7J0BvcHRpb24nOiBuZXdPcHRpb259KSk7XG5cbiAgICAkKCcuanMtZGVsZXRlLW9wdGlvbicpLm9uKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgIGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG4gICAgICAkKGUuY3VycmVudFRhcmdldCkucGFyZW50KCkucmVtb3ZlKCk7XG4gICAgICBkaWNlLmRlbGV0ZU9wdGlvbihuZXdJZClcbiAgICAgIGNvbnNvbGUubG9nKCdvcHRpb24gaGFzIGJlZW4gZGVsZXRlZCcpO1xuICAgICAgY29uc29sZS5sb2coZGljZS5vcHRpb25zKTtcbiAgICB9KTtcblxuICAgICQoJy5qcy1vcHRpb24tdGV4dCcpLnZhbCgnJyk7XG4gICAgZGljZS5hZGRPcHRpb24obmV3SWQsIG5ld09wdGlvbik7XG4gICAgY29uc29sZS5sb2coZGljZS5vcHRpb25zKTtcbiAgfSlcblxuICAkKCcuanMtc2F2ZS1kaWNlJykuY2xpY2soKCkgPT4gZGljZS5zYXZlKCkpXG4gICQoJy5qcy1kZWxldGUtZGljZScpLmNsaWNrKCgpID0+IGRpY2UuZGVsZXRlKCkpXG59XG5cbmV4cG9ydCBkZWZhdWx0IHtjcmVhdGVEaWNlRWRpdFBhZ2V9XG4iLCJpbXBvcnQgRGVjaXNpb25MaXN0U3RhdGUgZnJvbSAnLi9Nb2RlbHMvRGVjaXNpb25MaXN0U3RhdGUnXG5pbXBvcnQgQ29tcG9uZW50U3RhdGUgZnJvbSAnLi9Nb2RlbHMvQ29tcG9uZW50U3RhdGUnXG5pbXBvcnQgRGljZUVkaXRWaWV3IGZyb20gJy4vRGljZUVkaXRQYWdlVmlldydcbmltcG9ydCB7QkFTRV9VUkwsIFBPUlR9IGZyb20gJy4vVXRpbHMvY29uc3RhbnRzJ1xuaW1wb3J0IHJlcGxhY2VBbGwgZnJvbSAnLi9VdGlscy9TdHJpbmdSZXBsYWNlcidcbmltcG9ydCBVdGlsRnVuYyBmcm9tICcuL1V0aWxzL0NsZWFySFRNTCdcblxuLy8gY3JlYXRlIHRoZSBob21lIHBhZ2Vcbi8vIGNvbnRyb2wgZmV0Y2hpbmcgbGlzdHMgb2YgZGVjaXNpb24gZGljZSBhbmQgaW5wdXQgYXMgaHRtbFxuY29uc3QgZGljZUVkaXRWaWV3ID0gZnVuY3Rpb24oY3R4KSB7XG4gIGNvbnN0IGlkID0gY3R4LnBhcmFtcy5kZWNpc2lvbklkO1xuICBjb25zb2xlLmxvZyhgaWQgPSAke2lkfWApO1xuICByZXR1cm4gUHJvbWlzZS5hbGwoW1xuICAgICAgRGVjaXNpb25MaXN0U3RhdGUuZ2V0RGljZUJ5SWQoY3R4LnBhcmFtcy5kZWNpc2lvbklkKSxcbiAgICAgIENvbXBvbmVudFN0YXRlLmdldENvbXBvbmVudCgnZGVjaXNpb24tZWRpdC1wYWdlJyksXG4gICAgICBDb21wb25lbnRTdGF0ZS5nZXRDb21wb25lbnQoJ2RlY2lzaW9uLWVkaXQtZmFjZScpLFxuICAgICAgQ29tcG9uZW50U3RhdGUuZ2V0Q29tcG9uZW50KCdkZWNpc2lvbi1lZGl0LW9wdGlvbicpXG4gICAgXSlcbiAgICAudGhlbigocGF5bG9hZCkgPT4ge1xuICAgICAgY29uc29sZS5sb2cocGF5bG9hZCk7XG4gICAgICBpZiAoIXBheWxvYWRbMF0pIHtcbiAgICAgICAgY29uc29sZS5sb2coJ3RoZXJlIGlzIG5vIGRpY2UgZGF0YScpO1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZXJlIGlzIG5vIGRhdGEnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIFV0aWxGdW5jLmNsZWFySHRtbCgnanMtbWFpbi1jb250ZW50JylcbiAgICAgICAgRGljZUVkaXRWaWV3LmNyZWF0ZURpY2VFZGl0UGFnZShwYXlsb2FkWzBdLCBwYXlsb2FkWzFdLCBwYXlsb2FkWzJdLCBwYXlsb2FkWzNdKTtcbiAgICAgIH1cbiAgICB9KTtcbn07XG5cbi8vIGV4cG9ydCBkZWZhdWx0IERpY2VWaWV3XG5leHBvcnQgZGVmYXVsdCB7ZGljZUVkaXRWaWV3fVxuIiwiaW1wb3J0IHJlcGxhY2VBbGwgZnJvbSAnLi9VdGlscy9TdHJpbmdSZXBsYWNlcidcblxuY29uc3QgY3JlYXRlRGljZVBhZ2UgPSBmdW5jdGlvbihkaWNlLCBwYWdlTGF5b3V0LCBkaWNlQ29tcG9uZW50LCBvcHRpb25Db21wb25lbnQpIHtcbiAgY29uc29sZS5sb2coJ2NyZWF0ZURpY2VQYWdlIHdhcyBjYWxsZWQnKTtcbiAgY29uc3QgZGljZU1hcCA9IHtcbiAgICAnQHRpdGxlJzogZGljZS5kZWNpc2lvbixcbiAgICAnQGRlc2NyaXB0aW9uJzogJ3RvIGJlIGRldGVybWluZWQnLFxuICAgICdAaWQnOiBkaWNlLl9pZFxuICB9XG4gIGNvbnN0IHBhZ2VNYXAgPSB7XG4gICAgJ0BpZCc6IGRpY2UuX2lkXG4gIH1cbiAgY29uc3QgZGljZUZhY2UgPSByZXBsYWNlQWxsKGRpY2VDb21wb25lbnQsIGRpY2VNYXApO1xuICBjb25zdCBwYWdlID0gcmVwbGFjZUFsbChwYWdlTGF5b3V0LCBwYWdlTWFwKTtcbiAgJCgnLmpzLW1haW4tY29udGVudCcpLmFwcGVuZChwYWdlKTtcbiAgJCgnLmpzLWRlY2lzaW9uLWZhY2UnKS5hcHBlbmQoZGljZUZhY2UpO1xuICAkKCcuanMtcm9sbCcpLmNsaWNrKChlKSA9PiB7XG4gICAgZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcbiAgICBkaWNlLnJvbGwoKS50aGVuKHJlc3VsdCA9PiBhbGVydChyZXN1bHQuY29udGVudCkpO1xuICB9KTtcblxuICBkaWNlLm9wdGlvbnMuZm9yRWFjaChvcHRpb24gPT4ge1xuICAgICQoJy5qcy1vcHRpb25zLWxpc3QnKS5hcHBlbmQocmVwbGFjZUFsbChvcHRpb25Db21wb25lbnQsIHsnQG9wdGlvbic6IG9wdGlvbi5jb250ZW50fSkpO1xuICB9KVxufVxuXG5leHBvcnQgZGVmYXVsdCB7Y3JlYXRlRGljZVBhZ2V9XG4iLCJpbXBvcnQgRGVjaXNpb25MaXN0U3RhdGUgZnJvbSAnLi9Nb2RlbHMvRGVjaXNpb25MaXN0U3RhdGUnXG5pbXBvcnQgQ29tcG9uZW50U3RhdGUgZnJvbSAnLi9Nb2RlbHMvQ29tcG9uZW50U3RhdGUnXG5pbXBvcnQgRGljZVBhZ2VWaWV3IGZyb20gJy4vRGljZVBhZ2VWaWV3J1xuaW1wb3J0IHtCQVNFX1VSTCwgUE9SVH0gZnJvbSAnLi9VdGlscy9jb25zdGFudHMnXG5pbXBvcnQgcmVwbGFjZUFsbCBmcm9tICcuL1V0aWxzL1N0cmluZ1JlcGxhY2VyJ1xuaW1wb3J0IFV0aWxGdW5jIGZyb20gJy4vVXRpbHMvQ2xlYXJIVE1MJ1xuXG4vLyBjcmVhdGUgdGhlIGhvbWUgcGFnZVxuLy8gY29udHJvbCBmZXRjaGluZyBsaXN0cyBvZiBkZWNpc2lvbiBkaWNlIGFuZCBpbnB1dCBhcyBodG1sXG5jb25zdCBkaWNlVmlldyA9IGZ1bmN0aW9uKGN0eCkge1xuICBjb25zdCBpZCA9IGN0eC5wYXJhbXMuZGVjaXNpb25JZDtcbiAgY29uc29sZS5sb2coYGlkID0gJHtpZH1gKTtcbiAgcmV0dXJuIFByb21pc2UuYWxsKFtcbiAgICAgIERlY2lzaW9uTGlzdFN0YXRlLmdldERpY2VCeUlkKGN0eC5wYXJhbXMuZGVjaXNpb25JZCksXG4gICAgICBDb21wb25lbnRTdGF0ZS5nZXRDb21wb25lbnQoJ2RlY2lzaW9uLXBhZ2UnKSxcbiAgICAgIENvbXBvbmVudFN0YXRlLmdldENvbXBvbmVudCgnZGVjaXNpb24tZmFjZScpLFxuICAgICAgQ29tcG9uZW50U3RhdGUuZ2V0Q29tcG9uZW50KCdkZWNpc2lvbi1vcHRpb24nKVxuICAgIF0pXG4gICAgLnRoZW4oKHBheWxvYWQpID0+IHtcbiAgICAgIGlmICghcGF5bG9hZFswXSkge1xuICAgICAgICBjb25zb2xlLmxvZygndGhlcmUgaXMgbm8gZGljZSBkYXRhJyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlcmUgaXMgbm8gZGF0YScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgVXRpbEZ1bmMuY2xlYXJIdG1sKCdqcy1tYWluLWNvbnRlbnQnKTtcbiAgICAgICAgRGljZVBhZ2VWaWV3LmNyZWF0ZURpY2VQYWdlKHBheWxvYWRbMF0sIHBheWxvYWRbMV0sIHBheWxvYWRbMl0sIHBheWxvYWRbM10pO1xuICAgICAgfVxuICAgIH0pO1xufTtcblxuLy8gZXhwb3J0IGRlZmF1bHQgRGljZVZpZXdcbmV4cG9ydCBkZWZhdWx0IHtkaWNlVmlld31cbiIsImltcG9ydCBEZWNpc2lvbkxpc3RTdGF0ZSBmcm9tICcuL01vZGVscy9EZWNpc2lvbkxpc3RTdGF0ZSdcbmltcG9ydCBDb21wb25lbnRTdGF0ZSBmcm9tICcuL01vZGVscy9Db21wb25lbnRTdGF0ZSdcbmltcG9ydCBEZWNpc2lvbkNhcmRWaWV3IGZyb20gJy4vRGVjaXNpb25DYXJkVmlldydcbmltcG9ydCBVdGlsRnVuYyBmcm9tICcuL1V0aWxzL0NsZWFySFRNTCdcblxuLy8gY3JlYXRlIHRoZSBob21lIHBhZ2Vcbi8vIGNvbnRyb2wgZmV0Y2hpbmcgbGlzdHMgb2YgZGVjaXNpb24gZGljZSBhbmQgaW5wdXQgYXMgaHRtbFxuY29uc3Qgdmlld0hvbWUgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ3ZpZXdIb21lIHN0YXJ0aW5nIDEyMycpO1xuXG4gIHJldHVybiBQcm9taXNlLmFsbChbXG4gICAgICBEZWNpc2lvbkxpc3RTdGF0ZS5nZXREaWNlKCksXG4gICAgICBDb21wb25lbnRTdGF0ZS5nZXRDb21wb25lbnQoJ2RlY2lzaW9uLWNhcmQnKVxuICAgIF0pXG4gICAgLnRoZW4oKHBheWxvYWQpID0+IHtcbiAgICAgIGNvbnNvbGUubG9nKHBheWxvYWQpO1xuICAgICAgaWYgKHBheWxvYWRbMF0ubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnNvbGUubG9nKCd0aGVyZSBpcyBubyBkYXRhJyk7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignVGhlcmUgaXMgbm8gZGF0YScpO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIC8vICQoJy5qcy1tYWluLWNvbnRlbnQnKS5odG1sKCcnKTtcbiAgICAgICAgVXRpbEZ1bmMuY2xlYXJIdG1sKCdqcy1tYWluLWNvbnRlbnQnKTtcbiAgICAgICAgcGF5bG9hZFswXS5mb3JFYWNoKGRpY2UgPT4ge1xuICAgICAgICAgIERlY2lzaW9uQ2FyZFZpZXcuY3JlYXRlRGVjaXNpb25DYXJkKGRpY2UsIHBheWxvYWRbMV0pO1xuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pO1xufTtcblxuZXhwb3J0IGRlZmF1bHQge3ZpZXdIb21lfVxuIiwiaW1wb3J0IHtCQVNFX1VSTCwgUE9SVH0gZnJvbSAnLi4vVXRpbHMvY29uc3RhbnRzJ1xuXG5jb25zdCBDT01QT05FTlRTX09CSiA9IHt9O1xuXG4vLyBhZGQgY29tcG9uZW50IHRvIENPTVBPTkVOVFNfT0JKIGZvciBjYWNoaW5nXG5jb25zdCBhZGRDb21wb25lbnRUb1N0YXRlID0gKGtleSwgY29tcG9uZW50KSA9PiB7XG4gIENPTVBPTkVOVFNfT0JKW2tleV0gPSBjb21wb25lbnQ7XG59XG5cbi8vIHJldHVybiBhIENPTVBPTkVOVCBieSBrZXkgZnJvbSBpbi1tZW1vcnlcbmNvbnN0IGdldENvbXBvbmVudCA9IChrZXkpID0+IHtcbiAgY29uc29sZS5sb2coJ2dldENvbXBvbmVudCB3YXMgY2FsbGVkJyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzKSA9PiB7XG4gICAgaWYgKENPTVBPTkVOVFNfT0JKW2tleV0pIHtcbiAgICAgIHJlcyhDT01QT05FTlRTX09CSltrZXldKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2V0Q29tcG9uZW50QVBJKGtleSkudGhlbigoKSA9PiByZXMoQ09NUE9ORU5UU19PQkpba2V5XSkpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8vIGdldCBjb21wb25lbnQgdGVtcGxhdGVzIGZyb20gYXBpXG5jb25zdCBnZXRDb21wb25lbnRBUEkgPSAobmFtZSkgPT4ge1xuICByZXR1cm4gbmV3IFByb21pc2UoKHJlcywgcmVqKSA9PiB7XG4gICAgY29uc3QgdGFyZ2V0ID0gYC9zdGF0aWMvJHtuYW1lfS5odG1sYDtcbiAgICBjb25zdCB1cmxTdHJpbmcgPSBgJHt0YXJnZXR9YDtcbiAgICAkLmFqYXgoe3VybDogdXJsU3RyaW5nfSlcbiAgICAgIC5kb25lKChjb21wb25lbnQpID0+IHtcbiAgICAgICAgYWRkQ29tcG9uZW50VG9TdGF0ZShuYW1lLCBjb21wb25lbnQpO1xuICAgICAgICByZXMoY29tcG9uZW50KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfSlcbiAgICAgIC5mYWlsKChlcnIpID0+IHtyZWooYGNhbm5vdCBnZXQgY29tcG9uZW50IC0gRXJyb3I6ICR7ZXJyfWApfSk7XG4gIH0pXG59O1xuXG5leHBvcnQgZGVmYXVsdCB7Z2V0Q29tcG9uZW50fTtcbiIsImltcG9ydCBEaWNlIGZyb20gJy4vRGljZU1vZGVsJ1xuaW1wb3J0IHtCQVNFX1VSTCwgUE9SVH0gZnJvbSAnLi4vVXRpbHMvY29uc3RhbnRzJ1xuXG5jb25zdCBERUNJU0lPTl9MSVNUID0gW107XG5cbi8vIGFkZCBkaWNlIHRvIGRlY2lzaW9uIGxpc3RcbmNvbnN0IGFkZERpY2UgPSAoZGljZSkgPT4ge0RFQ0lTSU9OX0xJU1QucHVzaChuZXcgRGljZShkaWNlKSl9O1xuXG4vLyByZW1vdmUgZGljZSBmcm9tIGRlY2lzaW9uIGxpc3QgYnkgSURcbmNvbnN0IHJlbW92ZURpY2VCeUlkID0gKGRpY2VfaWQpID0+IHtcbiAgREVDSVNJT05fTElTVC5zcGxpY2UoREVDSVNJT05fTElTVC5pbmRleE9mKGRpY2UgPT4gZGljZSA9PT0gZGljZV9pZCksIDEpO1xufTtcblxuLy8gcmVtb3ZlIGFsbCBkaWNlIHRvIGRlY2lzaW9uIGxpc3RcbmNvbnN0IHJlbW92ZUFsbERpY2UgPSAoKSA9PiB7REVDSVNJT05fTElTVC5sZW5ndGggPSAwfTtcblxuLy8gcmV0dXJuIGEgbGlzdCBvZiBkaWNlIGZyb20gaW4tbWVtb3J5XG5jb25zdCBnZXREaWNlID0gKCkgPT4ge1xuICBjb25zb2xlLmxvZygnZ2V0RGljZSB3YXMgY2FsbGVkJyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzKSA9PiB7XG4gICAgaWYgKERFQ0lTSU9OX0xJU1QubGVuZ3RoICE9PSAwKSB7XG4gICAgICByZXMoREVDSVNJT05fTElTVCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGdldERlY2lzaW9uTGlzdEFwaSgpLnRoZW4oKCkgPT4gcmVzKERFQ0lTSU9OX0xJU1QpKTtcbiAgICB9XG4gIH0pXG59XG5cbi8vIHJldHVybiBhIHNpbmdsZSBkaWNlIGZyb20gaW4tbWVtb3J5XG5jb25zdCBnZXREaWNlQnlJZCA9IChkZWNpc2lvbklkKSA9PiB7XG4gIGNvbnNvbGUubG9nKCdnZXREaWNlQnlJZCB3YXMgY2FsbGVkJyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzKSA9PiB7XG4gICAgaWYgKERFQ0lTSU9OX0xJU1QubGVuZ3RoICE9PSAwKSB7XG4gICAgICByZXMoREVDSVNJT05fTElTVC5maW5kKGRpY2UgPT4gZGljZS5faWQgPT09IGRlY2lzaW9uSWQpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZ2V0RGVjaXNpb25MaXN0QXBpKCkudGhlbigoKSA9PiByZXMoREVDSVNJT05fTElTVC5maW5kKGRpY2UgPT4gZGljZV9pZCA9PT0gZGVjaXNpb25JZCkpKTtcbiAgICB9XG4gIH0pXG59XG5cbi8vIGdldCBsaXN0cyBvZiBkZWNpc2lvbiBkaWNlIGZyb20gYXBpXG5jb25zdCBnZXREZWNpc2lvbkxpc3RBcGkgPSBmdW5jdGlvbigpIHtcbiAgY29uc29sZS5sb2coJ2dldERlY2lzaW9uTGlzdEFwaSB3YXMgY2FsbGVkJyk7XG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzLCByZWopID0+IHtcbiAgICBjb25zdCB0YXJnZXQgPSAnL2RlY2lzaW9ucyc7XG4gICAgY29uc3QgdXJsU3RyaW5nID0gYCR7dGFyZ2V0fWA7XG4gICAgJC5hamF4KHt1cmw6IHVybFN0cmluZ30pXG4gICAgICAuZG9uZShhbGxEaWNlSW5mbyA9PiB7XG4gICAgICAgIGFsbERpY2VJbmZvLmZvckVhY2goZGVjaXNpb24gPT4gYWRkRGljZShkZWNpc2lvbikpXG4gICAgICAgIHJlcygpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9KVxuICAgICAgLmZhaWwoZXJyID0+IHtyZWooYGNhbm5vdCBnZXQgZGljZSAtIEVycm9yOiAke2Vycn1gKX0pO1xuICB9KVxufTtcblxuZXhwb3J0IGRlZmF1bHQge2FkZERpY2UsIHJlbW92ZUFsbERpY2UsIGdldERpY2UsIGdldERpY2VCeUlkLCBnZXREZWNpc2lvbkxpc3RBcGl9O1xuIiwiaW1wb3J0IGdldFJhbmRvbU51bWJlciBmcm9tICcuLi9VdGlscy9SYW5kb21OR2VuZXJhdG9yJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgRGljZSB7XG5cbiAgY29uc3RydWN0b3IgKGRlY2lzaW9uKSB7XG4gICAgO1snX2lkJywgJ2RlY2lzaW9uJywgJ29wdGlvbnMnXS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBpZiAoIWRlY2lzaW9uLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBQYXJhbWV0ZXIgJHtrZXl9IGlzICByZXF1aXJlZC5gKTtcbiAgICAgIH1cbiAgICAgIHRoaXNba2V5XSA9IGRlY2lzaW9uW2tleV07XG4gICAgfSlcbiAgfVxuXG4gIHJvbGwgKCkge1xuICAgIHJldHVybiBnZXRSYW5kb21OdW1iZXIoMSwgdGhpcy5vcHRpb25zLmxlbmd0aClcbiAgICAgIC50aGVuKGNob3Nlbk9wdGlvbiA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLm9wdGlvbnNbY2hvc2VuT3B0aW9uXTtcbiAgICAgIH0pXG4gIH1cblxuICBkZWxldGVPcHRpb24gKG9wdGlvbklkKSB7XG4gICAgdGhpcy5vcHRpb25zLnNwbGljZShcbiAgICAgIHRoaXMub3B0aW9ucy5pbmRleE9mKFxuICAgICAgICB0aGlzLm9wdGlvbnMuZmluZChvcHQgPT4gb3B0LmZhY2UgPT09IG9wdGlvbklkKVxuICAgICAgKSwgMVxuICAgICk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgYWRkT3B0aW9uIChvcHRpb25JZCwgb3B0aW9uQ29udGVudCkge1xuICAgIHRoaXMub3B0aW9ucy5wdXNoKHtcbiAgICAgIGZhY2U6IG9wdGlvbklkLFxuICAgICAgY29udGVudDogb3B0aW9uQ29udGVudFxuICAgIH0pXG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3RhdGljIGxvYWQgKGRpY2VJZCkge1xuICAgIC8vIGdldCBkaWNlIHNvbWVob3cgZnJvbSBBUEkgYW5kIHJldHVybiBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aXRoIGEgRGljZVxuICAgIC8vIGluc3RhbmNlXG4gICAgcmV0dXJuIGpRdWVyeS5hamF4KCdhc2RmJywge1xuICAgICAgZGF0YToge1xuICAgICAgICBpZDogZGljZUlkXG4gICAgICB9XG4gICAgfSlcbiAgICAgIC50aGVuKHBheWxvYWQgPT4gbmV3IERpY2UocGF5bG9hZCkpXG4gIH1cblxuICBzdGF0aWMgc2F2ZSAoZGljZSkge31cblxuICBzdGF0aWMgZGVsZXRlIChkaWNlKSB7fVxuXG4gIHN0YXRpYyBmaW5kIChwYXJhbXMpIHt9XG5cbn1cbi8vXG4vLyBEaWNlLmxvYWQoMSlcbi8vICAgLnRoZW4oZGljZSA9PiBjb25zb2xlLmxvZyhkaWNlLl9pZCkpXG4vLyAgIC5jYXRjaChjb25zb2xlLmVycm9yKVxuIiwiY29uc3QgY2xlYXJIdG1sID0gZnVuY3Rpb24oZWxlbSkge1xuICAkKGAuJHtlbGVtfWApLmh0bWwoJycpO1xuICByZXR1cm47XG59O1xuXG5leHBvcnQgZGVmYXVsdCB7Y2xlYXJIdG1sfTtcbiIsImV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGdldFJhbmRvbU51bWJlcihtaW4sIG1heCkge1xuICBtaW4gPSBNYXRoLmNlaWwobWluKTtcbiAgbWF4ID0gTWF0aC5mbG9vcihtYXgpO1xuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIChtYXggLSBtaW4pKSArIG1pbik7XG59O1xuXG4vLyBwcm92aWRlZCBieTpcbi8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0phdmFTY3JpcHQvUmVmZXJlbmNlL0dsb2JhbF9PYmplY3RzL01hdGgvcmFuZG9tXG4iLCJleHBvcnQgZGVmYXVsdCBmdW5jdGlvbiByZXBsYWNlQWxsKHN0ciwgbWFwT2JqKXtcbiAgdmFyIHJlID0gbmV3IFJlZ0V4cChPYmplY3Qua2V5cyhtYXBPYmopLmpvaW4oXCJ8XCIpLFwiZ2lcIik7XG5cbiAgcmV0dXJuIHN0ci5yZXBsYWNlKHJlLCBmdW5jdGlvbihtYXRjaGVkKXtcbiAgICByZXR1cm4gbWFwT2JqW21hdGNoZWQudG9Mb3dlckNhc2UoKV07XG4gIH0pO1xufVxuXG4vLyBwcm92aWRlZCBieTpcbi8vIGh0dHBzOi8vc3RhY2tvdmVyZmxvdy5jb20vcXVlc3Rpb25zLzE1NjA0MTQwL3JlcGxhY2UtbXVsdGlwbGUtc3RyaW5ncy13aXRoLW11bHRpcGxlLW90aGVyLXN0cmluZ3NcbiIsImV4cG9ydHMuUE9SVCA9IHByb2Nlc3MuZW52LlBPUlQgfHwgODA4MDtcblxuZXhwb3J0cy5CQVNFX1VSTCA9ICdsb2NhbGhvc3QnO1xuIiwiaW1wb3J0IFJhbmRvbU5HZW5lcmF0b3IgZnJvbSAnLi9VdGlscy9SYW5kb21OR2VuZXJhdG9yJ1xuaW1wb3J0IENvbnN0YW50IGZyb20gJy4vVXRpbHMvY29uc3RhbnRzJ1xuaW1wb3J0IERpY2UgZnJvbSAnLi9Nb2RlbHMvRGljZU1vZGVsJ1xuaW1wb3J0IERlY2lzaW9uTGlzdCBmcm9tICcuL01vZGVscy9EZWNpc2lvbkxpc3RTdGF0ZSdcbmltcG9ydCBIb21lVk0gZnJvbSAnLi9Ib21lVmlld01hbmFnZXInO1xuaW1wb3J0IERpY2VWTSBmcm9tICcuL0RpY2VQYWdlVmlld01hbmFnZXInO1xuaW1wb3J0IERpY2VFZGl0Vk0gZnJvbSAnLi9EaWNlRWRpdFZpZXdNYW5hZ2VyJztcbi8vIGltcG9ydCB7RGljZVZpZXd9IGZyb20gJy4vRGljZVBhZ2VWaWV3TWFuYWdlcic7XG5pbXBvcnQgcGFnZSBmcm9tICdwYWdlJztcblxuLy8gaW5pdGlhbGl6ZSBwYWdlLmpzIGZvciByb3V0aW5nIGluIHRoZSBmcm9udC1lbmRcbnBhZ2UoJy8nLCBIb21lVk0udmlld0hvbWUpO1xuLy8gcGFnZSgnL2RpY2UnLCBEaWNlVk0uZGljZVZpZXcpO1xucGFnZSgnL2RpY2UvOmRlY2lzaW9uSWQnLCBEaWNlVk0uZGljZVZpZXcpO1xucGFnZSgnL2RpY2UvZWRpdC86ZGVjaXNpb25JZCcsIERpY2VFZGl0Vk0uZGljZUVkaXRWaWV3KTtcbi8vIHBhZ2UoJyonLCAoKSA9PiBjb25zb2xlLmxvZygnZmFsbCBiYWNrJykpO1xuLy8gcGFnZSgnL2Fib3V0Jywgdmlld0Fib3V0KTtcbi8vIHBhZ2UoJy9zaWduLXVwJywgc2lnblVwKTtcbi8vIHBhZ2UoJy9zaWduLWluJywgc2lnbkluKTtcbi8vIHBhZ2UoJy9zaWduLW91dCcsIHNpZ25PdXQpO1xuLy8gcGFnZSgnL25ldycsIGNyZWF0ZURpY2UpO1xuLy8gcGFnZSgnLzp1c2VybmFtZScsIHVzZXJQYWdlKTtcbi8vIHBhZ2UoJy86dXNlcm5hbWUvOmRlY2lzaW9uSWQnLCB2aWV3RGljZSk7XG4vLyBwYWdlKCcvOnVzZXJuYW1lLzpkZWNpc2lvbklkL2VkaXQnLCBlZGl0RGljZSk7XG4vLyBwYWdlKCcvOnVzZXJuYW1lLzpkZWNpc2lvbklkL2RlbGV0ZScsIGRlbGV0ZURpY2UpO1xuLy9cbnBhZ2UoeyBoYXNoYmFuZzogZmFsc2UgfSk7XG4iXX0=
