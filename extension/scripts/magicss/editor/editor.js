/* global amplify: false, utils, CodeMirror, jQuery, chrome */

// TODO: If remember text option is on, detect text change in another instance of this extension in some different tab

// TODO: Share constants across files (like magicss.js, editor.js and options.js) (probably keep them in a separate file as global variables)
var USER_PREFERENCE_AUTOCOMPLETE_SELECTORS = 'autocomplete-css-selectors',
    USER_PREFERENCE_USE_CUSTOM_FONT_SIZE = 'use-custom-font-size',
    USER_PREFERENCE_FONT_SIZE_IN_PX = 'font-size-in-px',
    USER_PREFERENCE_HIDE_ON_PAGE_MOUSEOUT = 'hide-on-page-mouseout';

(function ($) {
    'use strict';

    var CONSTANTS = {
        EDITOR_MIN_WIDTH: 301,
        EDITOR_MIN_HEIGHT: 40,
        EDITOR_DEFAULT_WIDTH: 301,
        EDITOR_DEFAULT_HEIGHT: 249
    };

    var chromeStorage;
    try {
        chromeStorage = chrome.storage.sync || chrome.storage.local;
    } catch (e) {
        // do nothing
    }

    var runOnceFor = function (fn, delay) {
        clearTimeout(fn.timer);
        fn.timer = setTimeout(fn, delay);
    };

    var nodeExistsInDom = function (el) {
        while (el) {
            if (el.nodeName === 'HTML') {
                return true;
            }
            el = el.parentNode;
        }
        return false;
    };

    /*
    // https://stackoverflow.com/questions/13382516/getting-scroll-bar-width-using-javascript/13382873#13382873
    var getScrollbarWidth = function () {
        var outer = document.createElement("div");
        outer.style.visibility = "hidden";
        outer.style.width = "100px";
        outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

        document.body.appendChild(outer);

        var widthNoScroll = outer.offsetWidth;
        // force scrollbars
        outer.style.overflow = "scroll";

        // add innerdiv
        var inner = document.createElement("div");
        inner.style.width = "100%";
        outer.appendChild(inner);

        var widthWithScroll = inner.offsetWidth;

        // remove divs
        outer.parentNode.removeChild(outer);

        return widthNoScroll - widthWithScroll;
    };
    var scrollbarWidth = getScrollbarWidth();

    // https://www.sitepoint.com/jquery-check-horizontal-scroll-present/
    var hasScroll = function (el, direction) {
        direction = (direction === 'vertical') ? 'scrollTop' : 'scrollLeft';
        var result = !! el[direction];
        if (!result) {
            el[direction] = 1;
            result = !!el[direction];
            el[direction] = 0;
        }
        return result;
    };
    /* */

    var flagUsingQuirksMode = (function () {
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/compatMode
        // https://stackoverflow.com/questions/627097/how-to-tell-if-a-browser-is-in-quirks-mode/627124#627124
        // http://help.dottoro.com/ljteklnx.php
        var inQuirksMode = (document.compatMode === "BackCompat") ? true : false;
        return inQuirksMode;
    }());

    // References:
    //     Why we need to use document.body.clientHeight in quirks mode - https://stackoverflow.com/questions/8052178/difference-between-document-documentelement-clientheight-and-document-body-clien/8053110#8053110
    //     General logic to get the viewport dimensions - https://stackoverflow.com/questions/1248081/get-the-browser-viewport-dimensions-with-javascript/36132694#36132694
    var getViewportHeightExcludingScroll = function () {
        var height;
        if (flagUsingQuirksMode) {
            // "(document.body || {})" and "|| Infinity" may not be required. Just using that for robustness.
            height = Math.min((document.body || {}).clientHeight || Infinity, window.innerHeight || Infinity);
        } else {
            // "|| window.innerHeight || 0" may not be required. Just using that for robustness.
            height = document.documentElement.clientHeight || window.innerHeight || 0;
        }

        // Alternative approach
        // height = window.innerHeight;
        // if (hasScroll(document.body, 'horizontal')) {
        //     height -= scrollbarWidth;
        // }
        return height;
    };
    var getViewportWidthExcludingScroll = function () {
        var width;
        if (flagUsingQuirksMode) {
            // "(document.body || {})" and "|| Infinity" may not be required. Just using that for robustness.
            width = Math.min((document.body || {}).clientWidth || Infinity, window.innerWidth || Infinity);
        } else {
            // "|| window.innerWidth || 0" may not be required. Just using that for robustness.
            width = document.documentElement.clientWidth || window.innerWidth || 0;
        }

        // Alternative approach
        // width = window.innerWidth;
        // if (hasScroll(document.body, 'vertical')) {
        //     width -= scrollbarWidth;
        // }
        return width;
    };

    var getRoundedBoundingClientRect = function (el) {
        var rect = el.getBoundingClientRect(),
            ob = {};
        for (var key in rect) {
            if (typeof rect[key] === 'number') {
                ob[key] = Math.round(rect[key]);
            }
        }
        return ob;
    };

    /*
    // Modified version of https://gist.github.com/davidtheclark/5515733
    // This modified version seems to work well with scrollbars based positioning for the floating editor
    function isElementInViewport(el) {
        var rect = getRoundedBoundingClientRect(el);
        return (
            rect.left >= 0 &&
            rect.top >= 0 &&
            rect.right <= getViewportWidthExcludingScroll() &&
            rect.bottom <= getViewportHeightExcludingScroll()
        );
    }
    /* */
    function isElementXInViewport(el) {
        var rect = getRoundedBoundingClientRect(el);
        return (
            rect.left >= 0 &&
            rect.right <= getViewportWidthExcludingScroll()
        );
    }
    function isElementYInViewport(el) {
        var rect = getRoundedBoundingClientRect(el);
        return (
            rect.top >= 0 &&
            rect.bottom <= getViewportHeightExcludingScroll()
        );
    }

    var mainAutoPositionEditor = function (thisOb) {
        /*
            // The approach to be used in this function

            if (negative positioning is set) {
                clear negative positioning
            }
            if (element is not in viewport) {
                adjust positioning if possible
                decrease width and height if possible
            }

            if (element is in viewport) {
                increase width and height if possible
                adjust positioning if possible
            }
        /* */

        let minWidth = CONSTANTS.EDITOR_MIN_WIDTH,
            minHeight = CONSTANTS.EDITOR_MIN_HEIGHT;

        let viewportHeightExcludingScroll = getViewportHeightExcludingScroll(),
            viewportWidthExcludingScroll = getViewportWidthExcludingScroll();

        let mainElement = thisOb.container,
            $cmWrapperElement = $(thisOb.cm.getWrapperElement());

        let rect,
            updateRect = function () {
                rect = getRoundedBoundingClientRect(mainElement);
            };

        updateRect();
        // Remove negative X positioning
        if (rect.left < 0) {
            mainElement.style.left = '0px';
        }
        // Remove negative Y positioning
        if (rect.top < 0) {
            mainElement.style.top = '0px';
        }

        updateRect();
        // Adjust X positioning (when x-axis is not in viewport)
        if (rect.left >= 0 && !isElementXInViewport(mainElement)) {
            let appliedLeft = parseInt(mainElement.style.left, 10),
                deltaX = rect.right - viewportWidthExcludingScroll;
            if (deltaX > rect.left) {
                deltaX = rect.left;
            }
            mainElement.style.left = (appliedLeft - deltaX) + 'px';
        }
        // Adjust Y positioning (when y-axis is not in viewport)
        if (rect.top >= 0 && !isElementYInViewport(mainElement)) {
            let appliedTop = parseInt(mainElement.style.top, 10),
                deltaY = rect.bottom - viewportHeightExcludingScroll;
            if (deltaY > rect.top) {
                deltaY = rect.top;
            }
            mainElement.style.top = (appliedTop - deltaY) + 'px';
        }

        updateRect();
        // Adjust editor's width (when x-axis is not in viewport)
        if (rect.left >= 0 && !isElementXInViewport(mainElement)) {
            let appliedWidth = parseInt($cmWrapperElement.css('width'), 10),
                deltaX = rect.right - viewportWidthExcludingScroll,
                useWidth = Math.max(minWidth, appliedWidth - deltaX);
            $cmWrapperElement.css('width', useWidth);
        }
        // Adjust editor's height (when y-axis is not in viewport)
        if (rect.top >= 0 && !isElementYInViewport(mainElement)) {
            let appliedHeight = parseInt($cmWrapperElement.css('height'), 10),
                deltaY = rect.bottom - viewportHeightExcludingScroll,
                useHeight = Math.max(minHeight, appliedHeight - deltaY);
            $cmWrapperElement.css('height', useHeight);
        }

        updateRect();
        // Adjust editor's width (when x-axis is in viewport)
        if (rect.left >= 0 && isElementXInViewport(mainElement)) {
            let appliedWidth = parseInt($cmWrapperElement.css('width'), 10),
                userPreferredWidth = thisOb.getDimensions().width;
            if (appliedWidth < userPreferredWidth) {
                let deltaX = viewportWidthExcludingScroll - rect.right,
                    useWidth = Math.min(
                        Math.max(minWidth, appliedWidth + deltaX),
                        userPreferredWidth
                    );
                $cmWrapperElement.css('width', useWidth);
            }
        }
        // Adjust editor's height (when y-axis is in viewport)
        if (rect.top >= 0 && isElementYInViewport(mainElement)) {
            let appliedHeight = parseInt($cmWrapperElement.css('height'), 10),
                userPreferredHeight = thisOb.getDimensions().height;
            if (appliedHeight < userPreferredHeight) {
                let deltaY = viewportHeightExcludingScroll - rect.bottom,
                    useHeight = Math.min(
                        Math.max(minHeight, appliedHeight + deltaY),
                        userPreferredHeight
                    );
                $cmWrapperElement.css('height', useHeight);
            }
        }

        updateRect();
        // Adjust X positioning (when x-axis is in viewport)
        if (rect.left >= 0 && isElementXInViewport(mainElement)) {
            let appliedLeft = parseInt(mainElement.style.left, 10),
                userPreferredLeft = thisOb.userPreference('ui-position-left');
            if (appliedLeft < userPreferredLeft) {
                let deltaX = viewportWidthExcludingScroll - rect.right;
                mainElement.style.left = Math.min((appliedLeft + deltaX), userPreferredLeft) + 'px';
            }
        }
        // Adjust Y positioning (when y-axis is in viewport)
        if (rect.top >= 0 && isElementYInViewport(mainElement)) {
            let appliedTop = parseInt(mainElement.style.top, 10),
                userPreferredTop = thisOb.userPreference('ui-position-top');
            if (appliedTop < userPreferredTop) {
                let deltaY = viewportHeightExcludingScroll - rect.bottom;
                mainElement.style.top = Math.min((appliedTop + deltaY), userPreferredTop) + 'px';
            }
        }
    };

    var autoPositionEditor = function (thisOb) {
        if (autoPositionEditor.raf) {
            window.cancelAnimationFrame(autoPositionEditor.raf);
        }

        autoPositionEditor.raf = window.requestAnimationFrame(function () {
            mainAutoPositionEditor(thisOb);
        });
    };

    class Editor {
        /**
         * Constructor
         * @param {Object} options - The configuration object for the editor.
         * @param {string} [options.title=Text Editor] - The title of the editor.
         * @param {string} [options.tooltip=A simple text editor] - The tooltip of the editor.
         * TODO: Complete documentation
         */
        constructor (options) {
            utils.attachPublishSubscribe(this);     // Used for event handling

            options = options || {};
            var defaults = {
                title: 'Text Editor',
                tooltip: 'A simple text editor',
                placeholder: 'Write your text here...',
                disableCloseIcon: false,
                disableResize: false,
                draggable: true,
                closeOnEscapeKey: true,
                rememberText: true,
                rememberDimensions: true,
                textareaWrapAttr: 'off',
                bgColor: '54,64,118,0.75'
            };
            this.passedOptions = options;
            this.options = $.extend({}, defaults, this.passedOptions);

            this.normalizeOptions(this.options);     // Normalize the options object
            this.addDerivedOptions(this.options);    // Add derived options

            this.events = this.events || {};
            this.create();
        }

        // Normalize the options object
        normalizeOptions(options) {
            if (!options.id) {
                // If options.id is not available, then the panel cannot be uniquely identified
                // and hence remembered text will not be useful in fetching it back
                console.warn('options.rememberDimensions may not behave properly because there is no options.id');
                console.warn('options.rememberText may not behave properly because there is no options.id');
            }
            options.draggable = !!options.draggable;
            options.placeholder = options.placeholder || '';
            options.rememberDimensions = !!options.rememberDimensions;
            options.rememberText = !!options.rememberText;
        }

        addDerivedOptions(options) {
            if (options.rememberText || options.rememberDimensions) {
                // Add options.localDataKeyPrefix
                options.localDataKeyPrefix = options.id + '-';
            }
        }

        getOption(option) {
            return this.options[option];
        }

        defaultPreference(pref) {
            var defaultPreferences = Editor.defaultPreferences;
            if (defaultPreferences[pref] !== undefined) {
                return defaultPreferences[pref];
            } else {
                return '';
            }
        }

        userPreference(pref, value) {
            var prefix = this.options.localDataKeyPrefix;
            if (value === undefined) {
                return amplify.store(prefix + pref) || this.defaultPreference(pref);
            } else {
                amplify.store(prefix + pref, value);
                return this;
            }
        }

        bringCursorToView(options) {
            options = options || {};
            var cm = this.cm,
                cursorPos = cm.getCursor();

            if (options.pleaseIgnoreCursorActivity) { this.pleaseIgnoreCursorActivity = true; }

            // Reset the cursor and then set again to bring the current line of text back to view (scroll to view)
            // (CodeMirror does not scroll to cursor position when the cursor is already
            // at the position where your ask it to be set)
            cm.setCursor(0,0);

            // Scroll ahead by a few lines to give the user a view of lines near the current cursor position
            var aheadCursorPos = $.extend(true,{},cursorPos);
            aheadCursorPos.line += 4;
            cm.setCursor(aheadCursorPos);

            // Set the cursor position back to original
            cm.setCursor(cursorPos);

            if (options.pleaseIgnoreCursorActivity) { this.pleaseIgnoreCursorActivity = false; }
        }

        reposition(cb) {
            cb = cb || function () {};
            var thisOb = this,
                containerEl = thisOb.container;

            var isContainerHidden = $(thisOb.container).is(':visible') ? false : true,
                isContainerTrulyHidden = isContainerHidden
                    && thisOb.container.style.display === 'none'
                    && $(thisOb.container).parent().is(':visible');
            if (isContainerTrulyHidden) {
                thisOb.options.editorOb.show();
                cb();
            } else {
                var defaultLeft = thisOb.defaultPreference('ui-position-left'),
                    defaultTop = thisOb.defaultPreference('ui-position-top'),
                    defaultWidth = thisOb.defaultPreference('ui-size-width'),
                    defaultHeight = thisOb.defaultPreference('ui-size-height');

                var animationRequired = true;
                if (
                    parseInt($(containerEl).css('top'), 10) === defaultTop
                    && parseInt($(containerEl).css('left'), 10) === defaultLeft
                ) {
                    if (
                        $(thisOb.cm.getWrapperElement()).width() === defaultWidth
                        && $(thisOb.cm.getWrapperElement()).height() === defaultHeight
                    ) {
                        animationRequired = false;
                    }
                }

                if (animationRequired === false) {
                    thisOb.focus();     /* This is required if the text editor panel is being opened through some
                                           component which causes the textarea to lose focus. */
                    thisOb.triggerEvent('reInitialized', {
                        animDuration: 0,
                        targetWidth: defaultWidth,
                        targetHeight: defaultHeight
                    });

                    cb();
                } else {
                    var maxDuration = 750;

                    var textareaLeft = parseInt($(containerEl).css('left'), 10),
                        textareaTop = parseInt($(containerEl).css('top'), 10),
                        gapToCoverForPositioning = Math.sqrt(Math.pow((defaultLeft - textareaLeft), 2) + Math.pow((defaultTop - textareaTop), 2)),
                        $ta = $(containerEl).find('textarea.editor-editor'),
                        textareaWidth = parseInt($ta.css('width'), 10),
                        textareaHeight = parseInt($ta.css('height'), 10),
                        gapToCoverForResizing = Math.sqrt(Math.pow((defaultWidth - textareaWidth), 2) + Math.pow((defaultHeight - textareaHeight), 2)),
                        maxGapToCover = Math.max(gapToCoverForPositioning, gapToCoverForResizing),
                        duration = 100 + maxDuration * (Math.sqrt(maxGapToCover) / Math.sqrt(maxDuration / 1.5));
                    duration = parseInt(duration, 10);
                    if (duration > maxDuration) {
                        duration = maxDuration;
                    }

                    // TODO: Use better css specificity for identifying original textarea
                    // Animate to initial position
                    $(containerEl).css('width', '').css('height', '');
                    $(containerEl).animate({
                        top: defaultTop,
                        left: defaultLeft
                    }, duration, function () {
                        thisOb.savePosition({ top: defaultTop, left: defaultLeft });
                        thisOb.focus();
                        cb();
                    });

                    // TODO: Implement 'resizable' option

                    try {
                        thisOb.triggerEvent('reInitialized', {
                            animDuration: duration,
                            targetWidth: defaultWidth,
                            targetHeight: defaultHeight
                        });
                    } catch (e) {
                        // TODO: Handle this error
                    }
                }
            }
        }

        create() {
            var thisOb = this,
                options = thisOb.options;

            // If it already exists
            if (options.id && utils.gEBI(options.id)) {
                console.error('Error: Trying to create a new instance while an instance of "Editor" already exists with id: ' + options.id);
                return;
            }
            var top, left;
            if (options.rememberDimensions) {
                top = thisOb.userPreference('ui-position-top') + 'px';
                left = thisOb.userPreference('ui-position-left') + 'px';
            } else {
                top = '20px';
                left = '20px';
            }
            var strHTML = '<div' +
                (options.id ? ' id="' + options.id + '"' : '') +
                // "outline: 1px solid transparent" helps in avoiding the trails of movement which are left
                // when we auto-resize the component with motion when it is reinitialized
                // (which happens due to a Chrome/WebKit bug)
                ' style="outline: 1px solid transparent; top: ' + top + '; left: ' + left + '; font-family: Helvetica, &quot;Trebuchet MS&quot;, sans-serif">' +
            '</div>';
            var container = $(strHTML).get(0);
            thisOb.options.editorOb = thisOb;
            thisOb.container = container;

            utils.gEBTN('body')[0].appendChild(container);

            if (options.draggable) {
                thisOb._makeDraggable();
            }

            thisOb._addChildComponents();
            thisOb.initialize(options);

            window.onresize = function (e) {
                if (e.target !== window) {
                    return;
                }
                autoPositionEditor(thisOb);
            };
            autoPositionEditor(thisOb);
        }

        _makeDraggable() {
            var thisOb = this,
                options = thisOb.options;

            thisOb.container.style.cursor = 'move';
            $(thisOb.container).draggable({
                distance: 5,
                cancel: '.cancelDragHandle, textarea',
                opacity: 0.35,
                scroll: false,      // Do not auto scroll when dragging near the edges of the page
                start: function (evt, ui) {
                    // When a matching/non-matching bracket was highlighted, and the user tried to select some other piece
                    // of text, dragging was starting. This happened because the node was being removed from DOM, but jQuery UI's
                    // draggable logic wasn't handling that correctly. So, we do that here manually.
                    if (!nodeExistsInDom(evt.originalEvent.target)) {
                        // Need to fix opacity manually because jQuery UI doesn't set it back when we return "false" inside "start()"
                        ui.helper.css('opacity', 1);

                        // Do not start dragging
                        return false;
                    }

                    $(thisOb.container).addClass('noclick');
                    // This code will be used for functionality of providing free style draggability
                    // Clear corner positioning and allow free-style (jQuery uses top and left for draggable)
                    $(thisOb.container).css('bottom','').css('right','');
                },
                stop: function (event, ui) {
                    // Unattach 'noclick' class with an immediate timeout
                    // so that it executes after event (bubble) cycle is completed
                    setTimeout(function () {
                        $(thisOb.container).removeClass('noclick');
                    }, 0);

                    if (options.rememberDimensions) {
                        thisOb.savePosition({ top: ui.position.top, left: ui.position.left });
                    }

                    thisOb.focus();
                }
            });
        }

        _createSyntaxHighlighting() {
            var thisOb = this,
                options = thisOb.options;

            var newDiv = $('<div></div>').addClass('raw-codemirror-container');
            $(thisOb.textarea).parent().after(newDiv);

            var closeOnEscapeKey = true;
            if (options.closeOnEscapeKey === false || options.closeOnEscapeKey === null) {
                closeOnEscapeKey = false;
            }

            var indentWithTabs = thisOb.userPreference('use-tab-for-indentation') === 'yes';
            var codemirrorOptions = {
                value: thisOb.textarea.value,
                placeholder: thisOb.getOption('placeholder'),

                gutters: [],
                lint: false,
                lineNumbers: thisOb.userPreference('show-line-numbers') === 'yes' ? true : false,   // Eventually, lineNumbers also adds a value in "gutters" array

                styleActiveLine: {
                    nonEmpty: true
                },

                matchBrackets: true,

                keyMap: "sublime",
                showCursorWhenSelecting: true,

                indentWithTabs: indentWithTabs,
                indentUnit: (!indentWithTabs && parseInt(thisOb.userPreference('indentation-spaces-count'), 10)) || 4,
                undoDepth: 1000,

                extraKeys: {
                    // https://github.com/codemirror/CodeMirror/issues/988
                    Tab: function (cm) {
                        if (cm.doc.somethingSelected()) {
                            return CodeMirror.Pass;
                        }
                        var emmetExpanded = cm.execCommand('emmetExpandAbbreviation');
                        if (emmetExpanded === CodeMirror.Pass) {       // If it didn't expand, then "emmetExpanded === CodeMirror.Pass function"
                            if (indentWithTabs) {
                                return CodeMirror.Pass;
                            }
                            var spacesPerTab = cm.getOption('indentUnit'),
                                spacesToInsert = spacesPerTab - (cm.doc.getCursor('start').ch % spacesPerTab),
                                spaces = Array(spacesToInsert + 1).join(' ');
                            cm.replaceSelection(spaces, 'end', '+input');
                        }
                    },
                    Esc: function () {
                        // If there is some selection
                        if (thisOb.cm.getSelection()) {
                            // Clear selection
                            thisOb.setCursorPosition(
                                thisOb.getCursorPosition()
                            );
                        } else {
                            if (closeOnEscapeKey) {
                                thisOb.hide();
                            }
                        }
                    }
                }
            };

            var passedOptionsCombined = $.extend(
                true,
                {},
                options.codemirrorOptions,
                options.codemirrorOptions.optionsBasedOnUserPreference(thisOb.userPreference.bind(this))
            );
            delete passedOptionsCombined.optionsBasedOnUserPreference;  // Just cleaning up the object (not a compulsory thing to do)
            codemirrorOptions = $.extend(true, {}, codemirrorOptions, passedOptionsCombined);

            thisOb.triggerEvent('beforeInstantiatingCodeMirror');
            var cm = thisOb.cm = CodeMirror(newDiv.get(0), codemirrorOptions);

            cm.on('focus', function (cm, evt) { // eslint-disable-line no-unused-vars
                // https://github.com/webextensions/live-css-editor/issues/4
                if (!thisOb.cmInputFieldHasFocus()) {
                    // Most probably there is something problematic in focus behavior
                    thisOb.triggerEvent('problematicFocusDetected');
                }
            });

            var dimWH = thisOb.getDimensions();
            cm.setSize(dimWH.width, dimWH.height);

            var t_timer;
            cm.on('change', function() {
                var delay = 500;
                clearTimeout(t_timer);
                t_timer = setTimeout(function () {
                    thisOb.setTextValue(cm.getValue());
                    thisOb.triggerEvent('delayedtextchange');
                }, delay);
            });

            // http://stackoverflow.com/questions/4179708/how-to-detect-if-the-pressed-key-will-produce-a-character-inside-an-input-text/4180715#4180715
            var isCharacterKeyPress = function (evt) {
                if (typeof evt.which == "undefined") {
                    // This is IE, which only fires keypress events for printable keys
                    return true;
                } else if (typeof evt.which == "number" && evt.which > 0) {
                    // In other browsers except old versions of WebKit, evt.which is
                    // only greater than zero if the keypress is a printable key.
                    // We need to filter out backspace and ctrl/alt/meta key combinations
                    return !evt.ctrlKey && !evt.metaKey && !evt.altKey && evt.which != 8;
                }
                return false;
            };
            cm.on('keypress', function(cm, evt) {
                if (isCharacterKeyPress(evt)) {
                    if (CodeMirror.showHint) {
                        CodeMirror.showHint(cm);
                    }
                }
            });

            var fn = function () {
                thisOb.triggerEvent('_delayedcursorprobablymoved');
            };
            cm.on('cursorActivity', function() {
                if (thisOb.pleaseIgnoreCursorActivity) {
                    // do nothing
                } else {
                    runOnceFor(fn, 500);
                }
            });

            $(cm.getWrapperElement()).addClass('cancelDragHandle');
            $(cm.getWrapperElement()).resizable({
                handles: 'se',
                minWidth: CONSTANTS.EDITOR_MIN_WIDTH,
                minHeight: CONSTANTS.EDITOR_MIN_HEIGHT,
                start: function () {
                    // Save editor's position.
                    // It is useful when the user is resizing, but the position
                    // is out of sync with the value in userPreference (this
                    // out-of-sync is deliberate and useful for auto-positioning
                    // on window resize)
                    thisOb.savePosition({
                        top: parseInt(thisOb.container.style.top, 10),
                        left: parseInt(thisOb.container.style.left, 10)
                    });
                },
                stop: function (event, ui) {
                    thisOb.setTextContainerDimensions(
                        {
                            width: ui.size.width,
                            height: ui.size.height
                        },
                        {
                            propagateTo: 'codemirror'
                        }
                    );
                }
            });
        }

        _addChildComponents() {
            var thisOb = this,
                options = thisOb.options;

            if (!thisOb.container) {
                console.warn('Warning: You might have used _addChildComponents() before using create().');
            }

            var rememberText = options.rememberText,
                rememberDimensions = options.rememberDimensions;

            var divHeader = document.createElement('div');
            divHeader.className = 'magic-css-header';
            thisOb.container.appendChild(divHeader);

            var parentDivRightAligned = divHeader;

            var divHeaderLeft = document.createElement('div');
            divHeaderLeft.className = 'magic-css-header-left-section';
            divHeader.appendChild(divHeaderLeft);

            var title = options.title || 'Editor';

            if (typeof title === 'function') {
                var $title = title($, thisOb);
                $(divHeaderLeft).append($title);
            } else {
                $(divHeaderLeft).append($('<div>' + title + '</div>'));
            }

            options.headerOtherIcons = (options.headerOtherIcons || []).filter(function (item) { return !!item; });
            if (options.headerOtherIcons.length) {
                options.headerIcons = options.headerIcons || [];
                options.headerIcons.unshift({
                    name: 'more',
                    cls: 'editor-more-icons editor-gray-out cancelDragHandle',
                    afterrender: function (editor, moreIcon) {
                        var $moreIcon = $(moreIcon),
                            tooltipContent = ['<ul>'];

                        options.headerOtherIcons.forEach(function (iconOptions) {
                            tooltipContent.push(
                                '<li class="' + (iconOptions.cls ? ('li-' + iconOptions.cls) : '') + ' ' + (iconOptions.uniqCls ? ('li-' + iconOptions.uniqCls) : '') + '">' +
                                    '<a' +
                                    ' class="more-icons ' + (iconOptions.cls || '') + ' ' + (iconOptions.uniqCls || '') + '"' +
                                    ' href="' + (iconOptions.href || 'javascript:void(0);') + '"' +
                                    (iconOptions.href ? ' target="_blank"' : '') +
                                    '>' +
                                        iconOptions.title +
                                    '</a>' +
                                '</li>'
                            );
                            if (iconOptions.uniqCls && iconOptions.onclick) {
                                $('body').on('click', '.' + iconOptions.uniqCls, function(evt){
                                    evt.preventDefault();   // Useful in preventing the opening of a new tab in Firefox if the anchor-tag icon has target="_blank"
                                    iconOptions.onclick(evt, editor, $moreIcon);

                                    var originalSpeed = $moreIcon.tooltipster('option', 'speed');
                                    $moreIcon.tooltipster('option', 'speed', 0);
                                    $moreIcon.tooltipster('hide');
                                    $moreIcon.tooltipster('option', 'speed', originalSpeed);
                                });
                            }
                        });
                        tooltipContent.push('</ul>');
                        $moreIcon.tooltipster({
                            content: tooltipContent.join(''),
                            contentAsHTML: true,
                            position: 'bottom',
                            // https://github.com/iamceege/tooltipster/blob/3.3.0/js/jquery.tooltipster.js#L338
                            theme: 'tooltipster-default magic-css-tooltipster',
                            interactive: true,
                            interactiveTolerance: 350,
                            functionReady: function (origin, tooltip) {
                                options.headerOtherIcons.forEach(function (iconOptions) {
                                    if (iconOptions && iconOptions.beforeShow) {
                                        iconOptions.beforeShow(origin, tooltip, editor);
                                    }
                                });
                                // The tooltip would have rendered in hidden mode, but its width might have changed
                                // due to some changes via .beforeShow(), so, we need to reposition it
                                $moreIcon.tooltipster('reposition');
                            }
                        });
                    }
                });
            }

            options.headerIcons = (options.headerIcons || []).filter(function (item) { return !!item; });

            var disableCloseIcon = !!options.disableCloseIcon;
            if (!disableCloseIcon) {
                options.headerIcons = options.headerIcons || [];
                options.headerIcons.push({
                    name: 'close',
                    title: 'Close',
                    cls: 'editor-close',
                    onclick: function (evt, editor) {
                        editor.hide();
                    }
                });
            }

            if (options.headerIcons.length) {
                options.headerIcons.forEach(function (iconOptions) {
                    if (iconOptions.icons) {
                        iconOptions.afterrender = function (editor, divIcon) {
                            var $divIcon = $(divIcon),
                                tooltipContent = ['<ul>'];

                            iconOptions.icons = (iconOptions.icons || []).filter(function (item) { return !!item; });
                            iconOptions.icons.forEach(function (iconOptions) {
                                tooltipContent.push(
                                    '<li class="' + (iconOptions.cls ? ('li-' + iconOptions.cls) : '') + ' ' + (iconOptions.uniqCls ? ('li-' + iconOptions.uniqCls) : '') + '">' +
                                        '<a' +
                                        ' class="more-icons ' + (iconOptions.cls || '') + ' ' + (iconOptions.uniqCls || '') + '"' +
                                        ' href="' + (iconOptions.href || 'javascript:void(0)') + '"' +
                                        (iconOptions.href ? ' target="_blank"' : '') +
                                        '>' +
                                            iconOptions.title +
                                        '</a>' +
                                    '</li>'
                                );
                                if (iconOptions.uniqCls && iconOptions.onclick) {
                                    // $(document).on('click', '<selector>', callback(){...}) and
                                    // $('body').on('click', '<selector>', callback(){...}) are generally equivalent
                                    // and rather "$(document).on('click' ..." approach is more safe because that
                                    // script can be placed even in <head> section, but some sites may have
                                    // stopPropagation() like:
                                    //     $("body").on("click", function(evt) {
                                    //         evt.stopPropagation();
                                    //         ...
                                    //     }
                                    // So, in those cases, delegating the event via "body" element works better
                                    $('body').on('click', '.' + iconOptions.uniqCls, function(evt){
                                        evt.preventDefault();   // Useful in preventing the opening of a new tab in Firefox if the anchor-tag icon has target="_blank"
                                        iconOptions.onclick(evt, editor, $divIcon);

                                        var originalSpeed = $divIcon.tooltipster('option', 'speed');
                                        $divIcon.tooltipster('option', 'speed', 0);
                                        $divIcon.tooltipster('hide');
                                        $divIcon.tooltipster('option', 'speed', originalSpeed);
                                    });
                                }
                            });
                            tooltipContent.push('</ul>');
                            $divIcon.tooltipster({
                                content: tooltipContent.join(''),
                                contentAsHTML: true,
                                position: 'bottom',
                                // https://github.com/iamceege/tooltipster/blob/3.3.0/js/jquery.tooltipster.js#L338
                                theme: 'tooltipster-default magic-css-tooltipster',
                                interactive: true,
                                interactiveTolerance: 350,
                                functionReady: function (origin, tooltip) {
                                    iconOptions.icons.forEach(function (iconOptions) {
                                        if (iconOptions && iconOptions.beforeShow) {
                                            iconOptions.beforeShow(origin, tooltip, editor);
                                        }
                                    });
                                    // The tooltip would have rendered in hidden mode, but its width might have changed
                                    // due to some changes via .beforeShow(), so, we need to reposition it
                                    $divIcon.tooltipster('reposition');
                                }
                            });
                        };
                    }

                    var divIcon = document.createElement('div');
                    divIcon.className = (iconOptions.cls || '') + ' ' + (iconOptions.uniqCls || '') + ' editor-icon';
                    if (iconOptions.title) {
                        divIcon.title = iconOptions.title;
                    }
                    if (iconOptions.href) {
                        divIcon.innerHTML = '<a' +
                            ' href="' + (iconOptions.href || 'javascript:void(0)') + '"' +
                            (iconOptions.href ? ' target="_blank"' : '') +
                            ' style="width:100%;height:100%;display:block;text-decoration:none;">&nbsp;</a>';
                    }

                    parentDivRightAligned.appendChild(divIcon);

                    $(divIcon).click(function (evt) {
                        if (!$(thisOb.container).hasClass('noclick')) {
                            iconOptions.onclick && iconOptions.onclick(evt, thisOb, divIcon);
                        }
                    });
                    iconOptions.afterrender && iconOptions.afterrender(thisOb, divIcon);
                });
            }

            // Recall text value from local storage
            // It would be done only when rememberText is true
            thisOb.recallTextValue();

            var divContents = document.createElement('div');
            divContents.style.clear = 'both';
            divContents.className = 'raw-textarea-container';
            thisOb.container.appendChild(divContents);

            var textarea = document.createElement('textarea');
            thisOb.textarea = textarea;
            textarea.style.display = 'none';
            textarea.className = 'editor-editor';
            textarea.style.marginTop = '0';
            textarea.style.fontFamily = 'monospace';
            $(textarea).attr('spellcheck','false');

            textarea.style.minHeight = '1px';   // Fixes for issues where the site might have some custom CSS

            divContents.appendChild(textarea);
            var $textarea = $(textarea);

            if (rememberText) {
                $textarea.val(thisOb.getTextValue());
            }

            if (rememberDimensions) {
                textarea.style.width = thisOb.userPreference('ui-size-width') + 'px';
                textarea.style.height = thisOb.userPreference('ui-size-height') + 'px';
            } else {
                textarea.style.width = thisOb.defaultPreference('ui-size-width') + 'px';
                textarea.style.height = thisOb.defaultPreference('ui-size-height') + 'px';
            }

            var textareaWrapAttr = 'off';
            if (options.textareaWrapAttr) {
                textareaWrapAttr = options.textareaWrapAttr;
            }
            $textarea.attr('wrap', textareaWrapAttr);

            $textarea.attr('placeholder', thisOb.getOption('placeholder'));

            if (rememberText) {
                $textarea.keyup(function () {
                    thisOb.setTextValue($textarea.val());
                });
            }

            thisOb.container.style.padding = '0 7px 7px 7px';

            var disableResize = !!options.disableResize;
            if (!disableResize) {
                if (rememberDimensions) {
                    thisOb.initialWidth = thisOb.userPreference('ui-size-width');
                    thisOb.initialHeight = thisOb.userPreference('ui-size-height');
                } else {
                    thisOb.initialWidth = thisOb.defaultPreference('ui-size-width');
                    thisOb.initialHeight = thisOb.defaultPreference('ui-size-height');
                }
            } else {
                textarea.style.resize = 'none';
            }

            (function () {
                if (typeof options.footer === 'function') {
                    var $footer = options.footer($, thisOb);
                    $(thisOb.container).append($footer);
                }
            }());

            // Close on Escape key press
            (function () {
                var closeOnEscapeKey = true;
                if (options.closeOnEscapeKey === false || options.closeOnEscapeKey === null) {
                    closeOnEscapeKey = false;
                }

                if (closeOnEscapeKey) {
                    $textarea.keydown(function (evt) {
                        var keyCode = evt.keyCode || evt.which;
                        if (keyCode === 27) {
                            thisOb.hide();
                        }
                    });
                }
            }());

            thisOb._createSyntaxHighlighting();

            // Prevent scrolling on page body when mouse is scrolling '.section.tags .section-contents'
            $(thisOb.container).bind('mousewheel DOMMouseScroll', function (e) {
                var that = this,
                    $that = $(that),
                    delta = e.originalEvent.wheelDelta || -e.originalEvent.detail,
                    vScrollBar;

                vScrollBar = $that.find('.CodeMirror-vscrollbar');
                if (delta > 0) {
                    if (vScrollBar[0].scrollTop === 0) {
                        e.preventDefault();
                    }
                } else {
                    var originalScroll = vScrollBar.scrollTop();
                    vScrollBar.scrollTop(originalScroll + 1);
                    var newScroll = vScrollBar.scrollTop();
                    vScrollBar.scrollTop(originalScroll);

                    if (originalScroll === newScroll) {
                        e.preventDefault();
                    }
                }
            });

            // Set focus on textarea
            // ## Currently setting the focus on textarea after a delay, because at
            // this moment its parent container element's CSS position is not fixed.
            // It is set as fixed just a small bit later and hence the timeout here.
            // Ideally (not necessarily practically), the code should be (without timeout).
            thisOb.focus();

            thisOb.triggerEvent('launched');
        }

        initialize(options) {
            var thisOb = this;

            if (!thisOb.container) {
                try {
                    console.warn('You might have used initialize() before using create().');
                } catch (e) {
                    // do nothing
                }
            }

            var rememberDimensions = thisOb.options.rememberDimensions;

            if (options.cls) {
                $(thisOb.container).addClass(options.cls);
            }
            $(thisOb.container).addClass('magic-css-container');
            thisOb.container.style.position = 'fixed';
            if (rememberDimensions) {
                thisOb.container.style.top = thisOb.userPreference('ui-position-top') + 'px';
                thisOb.container.style.left = thisOb.userPreference('ui-position-left') + 'px';
            } else {
                thisOb.container.style.top = '20px';
                thisOb.container.style.left = '20px';
            }
            thisOb.container.style.width = 'auto';
            thisOb.container.style.height = 'auto';
            thisOb.container.style.borderRadius = '5px';
            thisOb.container.style.zIndex = '2147483600';
            thisOb.container.style.backgroundColor = 'rgba(' + options.bgColor + ')';
        }

        triggerEvent(eventName, config) {
            var thisOb = this;
            var events = thisOb.options.events;

            switch (eventName) {
                case 'launched':
                    if (events.launched) {
                        events.launched(thisOb);
                    }
                    break;
                case 'reInitialized':
                    if (events.reInitialized) {
                        events.reInitialized(thisOb, config);
                    }
                    break;
                case 'beforeshow':
                    if (events.beforeshow) {
                        events.beforeshow(thisOb);
                    }
                    break;
                case 'aftershow':
                    if (events.aftershow) {
                        events.aftershow(thisOb);
                    }
                    break;
                case 'beforehide':
                    if (events.beforehide) {
                        events.beforehide(thisOb);
                    }
                    break;
                case 'afterhide':
                    if (events.afterhide) {
                        events.afterhide(thisOb);
                    }
                    break;
                case 'clear':
                    if (events.clear) {
                        events.clear(thisOb);
                    }
                    thisOb.triggerEvent('testfortextchange');
                    break;
                case 'testfortextchange':
                    thisOb.triggerEvent('textchange');
                    break;
                case 'delayedtestfortextchange':
                    thisOb.triggerEvent('delayedtextchange');
                    break;
                case 'delayedcursormove':
                    if (events.delayedcursormove) {
                        events.delayedcursormove(thisOb);
                    }
                    break;
                case '_delayedcursorprobablymoved':
                    if (thisOb.isVisible()) {
                        if (thisOb.hasCursorMovedFromPreviousPosition()) {
                            thisOb.triggerEvent('delayedcursormove');
                        }
                        thisOb.recordCursorPosition();
                    }
                    break;
                case 'textchange':
                    if (events.textchange) {
                        events.textchange(thisOb);
                    }
                    break;
                case 'delayedtextchange':
                    if (events.delayedtextchange) {
                        events.delayedtextchange(thisOb);
                    }
                    break;
                case 'keyup':
                    if (events.keyup) {
                        events.keyup(thisOb);
                    }
                    thisOb.triggerEvent('testfortextchange');
                    break;
                case 'delayedkeyup':
                    if (events.delayedkeyup) {
                        events.delayedkeyup(thisOb);
                    }
                    thisOb.triggerEvent('delayedtestfortextchange');
                    thisOb.triggerEvent('_delayedcursorprobablymoved');
                    break;
                case 'beforeInstantiatingCodeMirror':
                    if (events.beforeInstantiatingCodeMirror) {
                        events.beforeInstantiatingCodeMirror(thisOb);
                    }
                    break;
                // There is a chance that something is problematic in focus behavior
                case 'problematicFocusDetected':
                    if (events.problematicFocusDetected) {
                        events.problematicFocusDetected(thisOb);
                    }
                    break;
                default:
                    console.warn('An unexpected event was attempted to be triggered: ' + eventName);
            }
        }

        getCursorPosition() {
            return this.cm.getCursor('start');
        }

        setCursorPosition(position) {
            return this.cm.setCursor(position);
        }

        cmInputFieldHasFocus () {
            return this.cm.getInputField() === document.activeElement;
        }

        recordCursorPosition() {
            this.previousCodeMirrorPosition = this.getCursorPosition();
        }

        hasCursorMovedFromPreviousPosition() {
            var thisOb = this,
                previousCodeMirrorPosition = thisOb.previousCodeMirrorPosition || {},
                currentCursorPosition = thisOb.getCursorPosition();
            if (
                currentCursorPosition.line === previousCodeMirrorPosition.line &&
                currentCursorPosition.ch === previousCodeMirrorPosition.ch
            ) {
                return false;
            }
            return true;
        }

        focus() {
            var cm = this.cm;
            setTimeout(function() {
                cm.focus();
            }, 0);
        }

        focusTextComponent(options) {
            var thisOb = this,
                line = 0,
                ch = 0;
            if (options) {
                line = options.line || 0;
                ch = options.ch || 0;
            }
            thisOb.cm.setCursor({
                line: line,
                ch: ch
            });
        }

        recallTextValue() {
            if (this.options.rememberText) {
                this.textValue = this.userPreference('textarea-value');
            }
        }

        getTextValue() {
            return this.textValue || '';
        }

        setTextValue(val) {
            if (this.options && this.options.rememberText) {
                this.userPreference('textarea-value', val);
            }
            this.textValue = val;
            return this;
        }

        getTextValueForNLines(line) {
            var textValue = this.getTextValue(),
                delimiter = '\n',
                start = line,
                tokens = textValue.split(delimiter).slice(0, start),
                result = tokens.join(delimiter);
            return result;
        }

        savePosition(options) {
            this.userPreference('ui-position-top', options.top).userPreference('ui-position-left', options.left);
        }

        getDimensions() {
            return {
                width: this.userPreference('ui-size-width'),
                height: this.userPreference('ui-size-height')
            };
        }

        saveDimensions(options) {
            this.userPreference('ui-size-width', options.width).userPreference('ui-size-height', options.height);
        }

        setTextContainerDimensions(options, propagateTo) {
            this.saveDimensions(options);
            if (propagateTo && propagateTo.propagateTo === 'codemirror') {
                this.setCodeMirrorDimensions(options);
            }
        }

        hide() {
            this.triggerEvent('beforehide');
            this.container.style.display = 'none';
            this.hidden = true;
            this.triggerEvent('afterhide');
        }

        show() {
            this.triggerEvent('beforeshow');
            this.container.style.display = '';
            this.hidden = false;
            this.focus();
            this.triggerEvent('aftershow');
        }

        isVisible() {
            return this.hidden ? false : true;
        }

        splitTextByCursor() {
            var cm = this.cm,
                strBeforeCursor = cm.getRange({line:0,ch:0}, cm.getCursor('start')),
                strAfterCursor = cm.getValue().substr(strBeforeCursor.length);
            return {
                strBeforeCursor: strBeforeCursor,
                strAfterCursor: strAfterCursor
            };
        }

        setCodeMirrorValue(val) {
            this.cm.setValue(val);
        }

        setCodeMirrorDimensions(options) {
            this.cm.setSize(options.width, options.height);
        }

        reInitCodeMirror() {
            var thisOb = this;
            thisOb.setCodeMirrorValue(thisOb.getTextValue());
            thisOb.setCodeMirrorDimensions(thisOb.getDimensions());

            var $that = $(thisOb.container);
            $that.addClass('mode-codeMirror');
        }

        setCursor(cursorPosition, options) {
            options = options || {};
            if (options.pleaseIgnoreCursorActivity) { this.pleaseIgnoreCursorActivity = true; }
            this.cm.setCursor(cursorPosition);
            if (options.pleaseIgnoreCursorActivity) { this.pleaseIgnoreCursorActivity = false; }
        }

        reInitTextComponent(options) {
            options = options || {};
            if (options.pleaseIgnoreCursorActivity) { this.pleaseIgnoreCursorActivity = true; }
            this.reInitCodeMirror();
            if (options.pleaseIgnoreCursorActivity) { this.pleaseIgnoreCursorActivity = false; }
        }
    }
    // TODO:
    // Move out the default preferences of Magic CSS into magicss.js
    Editor.defaultPreferences = {
        'magic-css-server-path': 'http://localhost:3777',  // TODO: Move this into Magic CSS code

        'language-mode': 'css',
        'use-css-linting': 'no',
        'disable-styles': 'no',
        'apply-styles-automatically': 'no',
        'watching-css-files': 'no',
        'use-tab-for-indentation': 'no',
        'indentation-spaces-count': '4',
        [USER_PREFERENCE_AUTOCOMPLETE_SELECTORS]: 'yes',
        [USER_PREFERENCE_HIDE_ON_PAGE_MOUSEOUT]: 'no',
        [USER_PREFERENCE_USE_CUSTOM_FONT_SIZE]: 'no',
        [USER_PREFERENCE_FONT_SIZE_IN_PX]: '12',
        'syntax-highlighting': 'yes',
        'show-line-numbers': 'no',
        'textarea-value': '',
        'ui-position-left': 20,
        'ui-position-top': 20,

        // Previously, we were using:
        //     'ui-size-width': 300,
        //     'ui-size-height': 250
        // But, some of the advertisement blocking extensions have logic like:
        //     [style*="width:300px; height:250px;"],
        //     [style*="width: 300px; height: 250px;"] {
        //         display: none !important;
        //     }
        // For example, one (or more) of the lists in uBlock Origin and Adblock Plus
        // was applying a style like the above for the page:
        //     https://www.msn.com/en-ae/
        // Now, we use 301x249 as the default size to avoid that
        'ui-size-width': CONSTANTS.EDITOR_DEFAULT_WIDTH,
        'ui-size-height': CONSTANTS.EDITOR_DEFAULT_HEIGHT
    };

    window.Editor = Editor;

    try {
        var waterfall = utils.waterfall;
        waterfall([
            // If there is an error, it would get caught in the first function itself
            // With the waterfall() function being used currently, errors in any of
            // the upcoming functions are not caught or reported in the final callback
            function (callback) {
                chromeStorage.get('default-language-mode', function (values) {
                    if (values && values['default-language-mode'] === 'less') {
                        Editor.defaultPreferences['language-mode'] = 'less';
                    } else if (values && values['default-language-mode'] === 'sass') {
                        Editor.defaultPreferences['language-mode'] = 'sass';
                    }
                    callback(null);
                });
            },
            function (callback) {
                chromeStorage.get(USER_PREFERENCE_AUTOCOMPLETE_SELECTORS, function (values) {
                    if (values && values[USER_PREFERENCE_AUTOCOMPLETE_SELECTORS] === 'no') {
                        Editor.defaultPreferences[USER_PREFERENCE_AUTOCOMPLETE_SELECTORS] = 'no';
                    }
                    callback(null);
                });
            },
            function (callback) {
                chromeStorage.get(USER_PREFERENCE_HIDE_ON_PAGE_MOUSEOUT, function (values) {
                    if (values && values[USER_PREFERENCE_HIDE_ON_PAGE_MOUSEOUT] === 'yes') {
                        Editor.defaultPreferences[USER_PREFERENCE_HIDE_ON_PAGE_MOUSEOUT] = 'yes';
                    }
                    callback(null);
                });
            },
            function (callback) {
                chromeStorage.get('use-tab-for-indentation', function (values) {
                    if (values && values['use-tab-for-indentation'] === 'yes') {
                        Editor.defaultPreferences['use-tab-for-indentation'] = 'yes';
                    }
                    callback(null);
                });
            },
            function (callback) {
                chromeStorage.get('indentation-spaces-count', function (values) {
                    var value = parseInt(values && values['indentation-spaces-count'], 10);
                    if (!isNaN(value)) {
                        Editor.defaultPreferences['indentation-spaces-count'] = '' + value;
                    }
                    callback(null);
                });
            },
            function (callback) {
                chromeStorage.get(USER_PREFERENCE_USE_CUSTOM_FONT_SIZE, function (values) {
                    if (values && values[USER_PREFERENCE_USE_CUSTOM_FONT_SIZE] === 'yes') {
                        Editor.defaultPreferences[USER_PREFERENCE_USE_CUSTOM_FONT_SIZE] = 'yes';
                    }
                    callback(null);
                });
            },
            function (callback) {
                chromeStorage.get(USER_PREFERENCE_FONT_SIZE_IN_PX, function (values) {
                    var value = parseInt(values && values[USER_PREFERENCE_FONT_SIZE_IN_PX], 10);
                    if (!isNaN(value)) {
                        Editor.defaultPreferences[USER_PREFERENCE_FONT_SIZE_IN_PX] = '' + value;
                    }
                    callback(null);
                });
            },
            function (callback) {
                chromeStorage.get('use-css-linting', function (values) {
                    if (values && values['use-css-linting'] === 'yes') {
                        Editor.defaultPreferences['use-css-linting'] = 'yes';
                    }
                    callback(null);
                });
            }
        ], function () {
            Editor.usable = true;
        });
    } catch (e) {
        Editor.usable = true;
    }
}(jQuery));
