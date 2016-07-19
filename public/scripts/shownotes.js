/**
 * Created by dave on 7/18/16.
 */

$(document).ready(function () {
    $("#outliner").concord({
        "prefs": {
            "outlineFont": "Georgia",
            "outlineFontSize": 18,
            "outlineLineHeight": 24,
            "renderMode": false,
            "readonly": false,
            "typeIcons": appTypeIcons
        },
    });
    opXmlToOutline(initialOpmltext);

    //set the page title
    $('li#showSelector.dropdown a span.name').text('Shownotes');

    //Move cursors within a content editable element
    //___via: http://stackoverflow.com/questions/1125292/how-to-move-cursor-to-end-of-contenteditable-entity
    function moveCursorToStart(contentEditableElement) {
        var range, selection;
        if (document.createRange)//Firefox, Chrome, Opera, Safari, IE 9+
        {
            range = document.createRange();//Create a range (a range is a like the selection but invisible)
            range.selectNodeContents(contentEditableElement);//Select the entire contents of the element with the range
            range.collapse(true);//collapse the range to the end point. false means collapse to end rather than the start
            selection = window.getSelection();//get the selection object (allows you to change selection)
            selection.removeAllRanges();//remove any selections already made
            selection.addRange(range);//make the range you have just created the visible selection
        }
        else if (document.selection)//IE 8 and lower
        {
            range = document.body.createTextRange();//Create a range (a range is a like the selection but invisible)
            range.moveToElementText(contentEditableElement);//Select the entire contents of the element with the range
            range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
            range.select();//Select the range (make it the visible selection
        }
    }

    function moveCursorToEnd(contentEditableElement) {
        var range, selection;
        if (document.createRange)//Firefox, Chrome, Opera, Safari, IE 9+
        {
            range = document.createRange();//Create a range (a range is a like the selection but invisible)
            range.selectNodeContents(contentEditableElement);//Select the entire contents of the element with the range
            range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
            selection = window.getSelection();//get the selection object (allows you to change selection)
            selection.removeAllRanges();//remove any selections already made
            selection.addRange(range);//make the range you have just created the visible selection
        }
        else if (document.selection)//IE 8 and lower
        {
            range = document.body.createTextRange();//Create a range (a range is a like the selection but invisible)
            range.moveToElementText(contentEditableElement);//Select the entire contents of the element with the range
            range.collapse(false);//collapse the range to the end point. false means collapse to end rather than the start
            range.select();//Select the range (make it the visible selection
        }
    }

    //Hot keys
    $(window).bind('keydown keyup keypress', function (event) {
        if (event.ctrlKey || event.metaKey) {
            switch (String.fromCharCode(event.which).toLowerCase()) {
                case 's':
                    event.preventDefault();
                    break;
                case 'l':
                    event.preventDefault();
                    break;
                case 'f':
                    event.preventDefault();
                    break;
                case 'g':
                    event.preventDefault();
                    break;
                case ',':
                    event.preventDefault();
                    break;
            }
        }
    });
    key('ctrl+l,command+l', function () {
        //menubar.find('.menuAddLink').trigger('click');
        alert("linkify");
        return false;
    });
    key('ctrl+shift+f,command+shift+f', function () {
        //showEditorFileDropZone();
        //$('#uploadifive-editor_upload > input[type=file]:last-child').trigger('click');
        return false;
    });
    key('ctrl+left,command+left', function () {
        if (!opInTextMode()) {
            opFirstSummit();
            window.scrollTo(0, 0);
        } else {
            var box = $('#outliner').find('.concord-cursor .concord-wrapper .concord-text')[0];
            moveCursorToStart(box);
        }
        return false;
    });
    key('ctrl+right,command+right', function () {
        if (!opInTextMode()) {
            opGo(left, 32767);
            opGo(down, 32767);
            window.scrollTo(0, 999999);
            while (opHasSubs() && opSubsExpanded()) {
                opGo(right, 1);
                opGo(down, 32767);
            }
            window.scrollTo(0, 999999);
        } else {
            var box = $('#outliner').find('.concord-cursor .concord-wrapper .concord-text')[0];
            moveCursorToEnd(box);
        }
        return false;
    });
    key('ctrl+up,command+up', function () {
        $('#outliner').concord().op.go('up', 32767);
    });
    key('ctrl+down,command+down', function () {
        $('#outliner').concord().op.go('down', 32767);
    });
    key('escape', function () {
        if (!opInTextMode()) {
            opSetTextMode(true);
        } else {
            opSetTextMode(false);
        }
    });

    //Load the existing script here if there is one

    opSetTextMode(true);
});