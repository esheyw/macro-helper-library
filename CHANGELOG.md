# PF2e Macro & Helper Library Changelog

## Version 0.1
- Existance begins.

## Version 0.1.1
- reattempt github actions

## Version 0.1.2
- fix imports

## Version 0.1.3
- fix error string in `oneTokenOnly()`
- actually import targetHelpers
- add some debug to `applyOwnershipToFolderStructure()`
- fixed data path in `setInitiativeStatistic()`

## Version 0.2.0
- add `updateInitiativeSkillsDialog()` macro
- add `MHDialog` class
- various tidyup
- add `isEmpty()` helper
- add `log` and `mhlog` helpers

## Version 0.2.1
- fix changelog

## Version 0.2.2
- switch to SASS for styling
  - add SASS compilation to github actions
- remove `isEmpty` helper, I didn't realize there was already one in `foundry.utils`
- implement new version of updateInitiativeStatistics
- document updateInitiativeStatistics

## Version 0.2.3
- fix imports in macros/index.mjs
- update workflow again?

## Version 0.2.4
- update workflow again again

## Version 0.2.5
- become npm package, write own simple sass compile job
- it works! release finally.

## Version 0.2.6
- Attempt new foundry package release API
- Update MHLDialog's template-as-content support to allow prototype method and property use, matching the behaviour of foundry's `renderTemplate()`

## Version 0.2.7 
- *Actually* update the template call properly.

## Version 0.2.8
- Test cli pack-on-release

## Version 0.3.0
- Gone system-agnostic! No longer strictly a PF2e module, please excuse the module ID, they're more trouble to change than it's worth
  - Only load system specific helpers in their home system
  - Add system gating to PF2e-specific macros
  - ***Breaking*** Will not populate `game.pf2emhl` by default anymore, this can be restored with the Legacy Access setting, but will only be available post-`i18nInit` hook.
  - Added Global Access setting to put the API in global scope as `mhl`
  - If neither of the above options are enabled (the default state), the API can always be accessed via `game.modules.get('pf2e-module-helper-library').api`. This is recommended for anyone using MHL as a module dependency.
  - I have done basically no testing in systems other than PF2e. Please open issues if things break in your system, and I'll do my best to support what I can :)
- Implemented MHLSettingsManager class
  - Extensions to setting registration
  - Handling for any hooks conditional on settings
  - Option to automatically make 'reset to default' buttons per setting, and a reset all button in the module header
  - Supports replacing setting inputs with clickable buttons with callbacks
  - Supports hiding settings fields depending on the value of other settings
  - Basic color picker support (base browser handling only)
- Improved MHLDialog handling of calling `.prompt` or `.confirm`
  - No longer ignores added fields, so `contentData` and `validator` are passed along appropriately
  - Support passing dialog options as second argument instead of only as an `options` key in the data parameter (why is this like this in core?!)
  - Also support passing render options as 3rd argument in both, since they just call `.wait` under the hood.
- Implemented the `getIconString` and `getIconClasses` string helpers for working with FontAwesome icons
- Implemented (ie, 100% lifted) the pf2e system's `sluggify` string helper, and the `htmlClosest`, `htmlQuery`, and `htmlQueryAll` DOM helpers. License noted in the readme.
- Removed the `capitalize` string helper; Foundry implements it as `String.capitalize()`, was redundant
  - Thanks to stwlam for pointing this out to me
- Reinstated old implementation of `isEmpty`, it returns true on general falsey-ness, which foundry's doesn't. MHLDialog field validation hasn't worked right since 0.2.2
- Improved handling of `localize` if called before i18nInit
  - Returns an error string (in English) containing a pasteable command to run once the world is loaded to re-attempt (almost always in the context of a thrown error)
  - Occasionally gets one or two levels of recursive but shouldn't blow up 🤞
- ***Breaking*** Changed the function signature of several helpers, see documentation for new specifics:
  - anyTokens, oneTokenOnly, anyTargets, oneTargetOnly
- ***Breaking*** Overhauled error handling functions, see documentation for new specifics
  - `log`, `localizedBanner`, `localizedError`, `mhlog`, `MHLBanner`, `MHLError` changed signatures slightly
  - Added `modlog` intermediary between mhlog and log, this is what you want to wrap for your own module.
  - Imlpemented the Log Level setting, defaults to Debug. Determines what level `mhlog` calls that aren't show-stoppers are logged at. Setting this to Warning or Error can be useful for troubleshooting MHL-related issues.
- Moved documentation from the README to [github wiki](https://github.com/esheyw/pf2e-macro-helper-library/wiki/Interim-API-Reference/)
- Added actual macros in the Helper Library Macros compendium for the existing macros.
  - Included icons for several of them from [game-icons.net](https://game-icons.net)
- Implemented the `doc`, `isRealGM`, and `activeRealGM` Other Helpers