/**
 * A function passable to `Array#sort` or similar
 * @typedef {(a:any,b:any) => number} SortCallback
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

/**
 * @typedef {object} DeeperCloneOptions
 * Options for MHL's `deeperClone` function
 * @property {boolean} [strict=false]           Throw an Error if deeperClone is unable to clone something instead of returning the original
 * @property {boolean} [returnOriginal=true]    Whether to pass along the reference to an uncloneable complex object, or replace with undefined
 * @property {boolean} [cloneSets=false]         Whether to clone Sets or pass along the original reference
 * @property {boolean} [cloneSetValues=false]   Whether to clone Set values, or pass along the original reference. Does nothing if cloneSets is false
 * @property {boolean} [cloneMaps=false]        Whether to clone Maps/Collections or pass along the original reference
 * @property {boolean} [cloneMapKeys=false]     Whether to clone Map/Collection keys, or pass along the original reference. Does nothing if cloneMaps is false
 * @property {boolean} [cloneMapValues=false]   Whether to clone Map/Collection values, or pass along the original reference. Does nothing if cloneMaps is false
 */

/**
 * @typedef {object} MHLMergeOptions
 * Options for MHL's `merge` function
 * @property {boolean} [insertKeys=true]         Control whether to insert new top-level objects into the resulting
 *                                                structure which do not previously exist in the original object.
 * @property {boolean} [insertValues=true]       Control whether to insert new nested values into child objects in
 *                                               the resulting structure which did not previously exist in the
 *                                               original object.
 * @property {boolean} [overwrite=true]          Control whether to replace existing values in the source, or only
 *                                               merge values which do not already exist in the original object.
 * @property {boolean} [recursive=true]          Control whether to merge inner-objects recursively (if true), or
 *                                               whether to simply replace inner objects with a provided new value.
 * @property {boolean} [inplace=true]            Control whether to apply updates to the original object in-place
 *                                               (if true), otherwise the original object is duplicated and the
 *                                               copy is merged.
 * @property {boolean} [enforceTypes=false]      Control whether strict type checking requires that the value of a
 *                                               key in the other object must match the data type in the original
 *                                               data to be merged.
 * @property {boolean} [performDeletions=false]  Control whether to perform deletions on the original object if
 *                                               deletion keys are present in the other object.
 * @property {boolean} [mergeArrays=true]        Control whether to merge or replace Arrays
 * @property {boolean} [mergeSets=true]          Control whether to merge or replace Sets
 * @property {DeeperCloneOptions} [cloneOptions] Options to pass along to `deeperClone`
 */
