/**
 * The return value of a sort callback
 * @typedef {-1|0|1} ComparisonResult
 */

/**
 * A function passable to `Array#sort` or similar
 * @typedef {(a:any,b:any) => ComparisonResult} SortCallback
 */

/**
 * Options for `createHTMLElement()`
 * @typedef {object} CreateHTMLElementOptions
 * @property {string[]} [classes=[]] Classes to apply to the created element
 * @property {Record<string, any>} [dataset={}] Dataset values to apply to the created element
 * @property {string} [innerHTML] Arbitrary innerHTML for the created element
 * @property {Array<HTMLElement|string>} [children=[]] Child elements or strings to be turned into text nodes, appendeded in order after innerHTML is applied if passed
 * @property {Record<string, any>} [attributes={}] Other attribute data to set on the created element
 *
 */

/**
 * @typedef {"error"|"warn"|"log"|"debug"} ConsoleType
 */

/**
 * @typedef {"error"|"warn"|"info"} BannerType
 */

/**
 * @typedef {object} LogOptions
 * @property {ConsoleType} [type="log"] The level to log at, must be "error", "warn", "log", or "debug". If left unset, will attempt fallback values in order:
 *                                      - the `log-level` setting if we can confirm we're in `debug-mode`
 *                                     - the `softType` parameter
 *                                     - the default of "debug"
 * @property {string} [text] Text to go before the loggable value, usually a description of why this log entry is being made
 * @property {boolean} [localize=true] Whether to localize `text` (or the loggable, if it's a string and text is not provided)
 * @property {object} [context] The context object passed to localize if `localize` is true
 * @property {string} [prefix] The prefix to prepend to the text, if any. Usually used for module abbreviations
 * @property {string} [func] The name of the calling function, to be prepended (after `mod`) to the text
 * @property {boolean|BannerType} [banner=false] If non-empty, defines the type of notification banner produced using `text`, must be "error", "warn", or "info". If `true`, will use a level commensurate with `type` or none if "debug"
 * @property {boolean} [permanent=false] If a banner is created, whether it should be permanent until clicked or not
 * @property {boolean} [console=true] Whether this log call will actually log to the console (for use if you only want to banner)
 * @property {boolean} [clone=false] Whether to call `deeperClone` on the loggable or not
 * @property {ConsoleType} [softType] If the function is called before settings can be retrieved, this type will be used instead of "debug" if provided
 * @property {boolean} [error=false] Whether to return a throwable Error or not
 */

/**
 * @typedef {object} IconFontSchemaPart
 * @property {string} [value] If provided, the value this part must match exactly (prefixes are not checked)
 * @property {string|RegExp} [pattern] The pattern to check against (not including prefix(es)) for this part
 * @property {boolean} [required=false] Whether to fail validation if this part is not found
 * @property {string[]} [choices] In lieu of `pattern`, a defined list of valid choices (not including prefix(es))
 * @property {string} [default] The value to use if a `required` part is not found
 * @property {string|string[]} [precludes] Other schema parts that this parts existence renders invalid, eg you can't flip and rotate the same icon in some fonts
 * @property {string[]} [prefixes] Any prefixes specific to this schema part. Overrides parent font entry's prefixes.
 * @property {number} [max=1] The maximum number of this part allowed to be found
 */

/**
 * @typedef {object} IconFontEntry
 * @property {string} name The name of the font, should be in slug-case. Must be unique.
 * @property {string[]} prefixes A list of prefixes this icon font uses. Must contain at least one entry.
 * @property {Record<string,IconFontSchemaPart>} schema The schema for this icon font.
 * @property {Record<string,string>} [aliases] A set of key/value substitutions to run on input before matching.
 * @property {string} [file] The CSS file for this icon font (only optional because FA is provided by core)
 
 */
