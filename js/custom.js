function timegap(start) {
    let startTime = new Date(start);
    let endTime = new Date();
    let usedTime = endTime - startTime;
    if (usedTime < 0)
        usedTime = 1;
    let days = Math.floor(usedTime / (24 * 3600 * 1000));
    let leavel = usedTime % (24 * 3600 * 1000);
    let hours = Math.floor(leavel / (3600 * 1000));
    let leavel2 = leavel % (3600 * 1000);
    let minutes = Math.floor(leavel2 / (60 * 1000));
    let leavel3 = leavel2 % (60 * 1000);
    let seconds = Math.floor(leavel3 / (1000));
    return {
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
    }
}

function shortTime(timemap) {
    if (timemap.days > 0)
        return timemap.days + '天';
    if (timemap.hours > 0)
        return ((timemap.hours < 10) ? '0' : '') + timemap.hours + '时';
    if (timemap.minutes > 0)
        return ((timemap.minutes < 10) ? '0' : '') + timemap.minutes + '分';
    if (timemap.seconds >= 0)
        return ((timemap.seconds < 10) ? '0' : '') + timemap.seconds + '秒';
}

function loop() {
    var exist_time = timegap("2021-01-03T00:00:00+08:00");
    let runbox = document.getElementById('run-time');
    runbox.innerHTML = shortTime(exist_time);
    var build_time = timegap(build_date);
    let buildbox = document.getElementById('build-time');
    buildbox.innerHTML = shortTime(build_time);
}

function loadExternalResource({
    url,
    type,
    is_defer = true,
    is_async = false,
    onload = undefined,
    onerror = undefined,
} = {}) {
    return new Promise((resolve, reject) => {
        let tag;

        if (type === "css") {
            tag = document.createElement("link");
            tag.rel = "stylesheet";
            tag.href = url;
            tag.defer = is_defer;
            tag.async = is_async;
        } else if (type === "js") {
            tag = document.createElement("script");
            tag.src = url;
            tag.defer = is_defer;
            tag.async = is_async;
        }

        if (tag) {
            tag.onload = () => { resolve(url); }
            tag.onerror = () => { reject(url); if (onerror) onerror(); }
            document.head.appendChild(tag);
        }

        if (onload) {
            tag.addEventListener('load', onload)
        }
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function isPC() {
    var agents_info = navigator.userAgent;
    var agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"];
    var ispc = true;
    for (var v = 0; v < agents.length; v++) {
        if (agents_info.indexOf(agents[v]) > 0) {
            ispc = false;
            break;
        }
    }
    return ispc;
}

function rand_post() {
    $('#my-random-posts').children().remove();
    let valid_links = preload_related_posts;
    if (valid_links == undefined || valid_links.length == 0) {
        $('#my-random-posts').remove();
        return;
    }

    $('#my-random-posts').append('<h3>相关文章&nbsp;&nbsp;<a onclick="rand_post();" style="cursor: pointer;"><i class="fa fa-random"></i></a></h3>');
    // shuffle
    valid_links.sort(function () {
        return Math.random() > 0.5 ? -1 : 1;
    });
    valid_links = valid_links.slice(0, 5);
    valid_links.sort(function (a, b) {
        return new Date(b['date']) - new Date(a['date']);
    });
    valid_links.forEach(function (link) {
        let line = '<a href="' + link['link'] + '">' + '<p class="friends-articles-line my-random-posts">' + '<span>' + link['title'] + '</span>' +
            '<span class="friends-articles-author">' + link['date'] + '</span>' + '</p></a>'
        $('#my-random-posts').append(line);
    });
};

function readerMode() {
    $('header').toggleClass('reader-mode');
    $('footer').toggleClass('reader-mode');
    $('.post-meta').toggleClass('reader-mode');
    $('.post-footer').toggleClass('reader-mode');
    // $('.orlike-box').toggleClass('reader-mode');
    $('#comments').toggleClass('reader-mode');
    $('#my-random-posts').toggleClass('reader-mode');
    $('#view-comments').toggleClass('reader-mode');
    $('.toc').toggleClass('reader-mode');

    $('#reader-button').toggleClass('reader-mode-npos');
    $('body').toggleClass('reader-mode-cl');
    $('article').toggleClass('reader-mode-cl');
    if ($('article.page').width() < $('body').width() * 0.8) {
        $('article.page').toggleClass('reader-mode-content');
    }

    localStorage.setItem('reder-mode', ($('.reader-mode').length > 0) ? 'on' : 'off');
}

$(document).ready(function () {
    if ($('#my-random-posts').length > 0) {
        rand_post();
    }

    loop();
    const runbox = document.getElementById('run-time');
    const buildbox = document.getElementById('build-time');
    const interval_time = (() => {
        if (runbox.innerHTML.includes('秒') || buildbox.innerHTML.includes('秒')) {
            return 1000;  // 1 second
        } else if (runbox.innerHTML.includes('分') || buildbox.innerHTML.includes('分')) {
            return 60000;  // 1 minute
        } else {
            return 3600000;  // 1 hour
        }
    })();
    setInterval(loop, interval_time);
    // loadExternalResource({ url: "https://hm.baidu.com/hm.js?19d1992f36a0a1272d7bf51277fb4fb0", type: "js" });

    if ($('#reader-button').length > 0) {
        if ($('article.page.single').length > 0 && localStorage.getItem('reder-mode') == 'on') {
            readerMode();
        }

        $('#reader-button').on('click', function (e) {
            readerMode();
        });
    }

    if ($('#reader-button-title').length > 0) {
        $('#reader-button-title').on('click', function (e) {
            readerMode();
        });
    }

    // if ($('article.page').length > 0) {
    //     $('#reader-button').css('display', 'block');
    //     if (preload_summary != undefined && preload_summary['summary'] != undefined) {
    //         let summary = preload_summary['summary'];
    //         summary = '**摘要**: ' + summary;
    //         summary += "  (**摘要评价**: " + preload_summary['score'] + ")";
    //         summary = marked.parse(summary);
    //         $('#content').prepend('<div class="summary">' + summary + '</div><hr/><br/>');
    //     }
    // }

    if ($('#build-timeline').length > 0) {
        $('#build-timeline').albeTimeline(buildtimeline, {
            effect: 'none',
            formatDate: 'MM-dd',
            showMenu: false,
            sortDesc: true
        });
    }

    if ($('#friends-articles').length > 0) {
        // just get csv file content
        // disable cache
        const timestamp = new Date().getTime();
        fetch("/friends_article.csv?" + timestamp)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(data => {
                $('.friends-articles-loading').remove();

                const lines = data.split('\n').slice(0, 6);
                const keys = lines[0].split(',');
                const keys_map = {
                    'date': keys.indexOf('date'),
                    'title': keys.indexOf('title'),
                    'link': keys.indexOf('link'),
                    'author': keys.indexOf('author'),
                }
                valid_links = lines.slice(1).map(function (line) {
                    const fields = line.split(',');
                    return {
                        'date': fields[keys_map['date']],
                        'title': fields[keys_map['title']],
                        'link': fields[keys_map['link']],
                        'author': fields[keys_map['author']],
                    }
                });
                valid_links.forEach(function (link) {
                    let line = '<p class="friends-articles-line"><span>' + link['date'] + '  <a href="' + link['link'] + '">' + link['title'] + '</a></span>' +
                        '<span class="friends-articles-author">' + link['author'] + '</span></p>'
                    $('#friends-articles').append(line);
                });
            })
            .catch(error => {
                $('.friends-articles-loading').remove();
                $('#friends-articles').append('<p style="color: #999;">暂无友链文章</p>');
                console.error('Failed to load friends articles:', error);
            });
    }
})
