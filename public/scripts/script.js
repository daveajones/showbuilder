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

    //Load the existing script here if there is one

    opSetTextMode(true);
});