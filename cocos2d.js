(function () {
    var d = document;
    var c = {
        COCOS2D_DEBUG: 0,
        box2d: true,
        showFPS: false,
        frameRate: 60,
        tag: 'viewport',
        SingleEnginFile: 'cocos2d/cocos2dx.min.js',
        appFiles: ['game.js']
    };
    window.addEventListener('DOMContentLoaded', function () {
        var s = d.createElement('script');
        s.src = c.SingleEnginFile;
        d.body.appendChild(s);
        s.c = c;
        s.id = 'cocos2d-html5';
    });
})();
