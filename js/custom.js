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

if ($('.friend-rand').length > 0) {
    $('.friend-rand').css("display", "none");
}

function nextISU() {
    $('.friend-rand').css("display", "inline");
    $('.friend-rand').text("挑一个, 吃掉!");

    var friend_btn = document.getElementsByClassName('friend-rand')
    if (friend_btn.length < 1) return;
    friend_btn = friend_btn[0];
    const max_time = 3000; //ms
    const max_loop = 2;
    const time_time = 1.2;
    let is_run = false;
    let friends = document.getElementsByClassName("frind-real");
    if (friends.length < 1) return;
    let urls = friends[0].getElementsByClassName("frined-url");
    let arr = [...new Array(urls.length).keys()]
    let all_loop = arr.length * max_loop;
    let each_p = new Array(all_loop);
    each_p[0] = 1;
    let each_sum = each_p[0];
    for (let i = 1; i < all_loop; i++) {
        each_p[i] = each_p[i - 1] * time_time;
        each_sum += each_p[i];
    }
    let sleep_time = max_time / each_sum;
    let lucky_url = urls[0];

    function chose(url) {
        url.style.opacity = 0.4;
    }

    function unchose(url) {
        url.style.opacity = 1;
    }

    friend_btn.addEventListener('click', async function () {
        if (is_run) {
            return;
        }
        is_run = true;
        for (let i = 0; i < urls.length; i++) {
            urls[i].style.opacity = 1;
        }
        // console.log(each_p)
        let last_url = undefined;
        for (let i = 0; i < max_loop; i++) {
            arr.sort(function () {
                return (0.5 - Math.random());
            });
            for (let j = 0; j < arr.length; j++) {
                if (last_url != undefined) {
                    unchose(last_url);
                }
                chose(urls[arr[j]]);
                last_url = urls[arr[j]];
                lucky_url = urls[arr[j]];
                let st = sleep_time * each_p[i * arr.length + j];
                // console.log(st)
                await sleep(st);
            }
        }
        for (let i = 0; i < 3; i++) {
            unchose(lucky_url);
            await sleep(100);
            chose(lucky_url);
            await sleep(100);
        }
        lucky_url.click();
        unchose(lucky_url);
        is_run = false;
    }, false);
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

function template_friend(url, name, word, logo, mclass = "") {
    return '<a target="_blank" href=' + url + ' title=' + name + '--' + word + ' class="friend url frined-url ' + mclass + ' ">' +
        '<div class="friend block whole">' +
        '<div class="friend block left">' +
        '<img class="friend logo" src=' + logo + ' onerror="this.src=\'https://gravatar.loli.net/avatar/c02f8b813aa4b7f72e32de5a48dc17a7?d=retro&v=1.4.14\'" />' +
        '</div>' +
        '<div class="friend block right">' +
        '<div class="friend name">' + name + '</div>' +
        '<div class="friend info">"' + word + '"</div>' +
        '</div>' +
        '</div>' +
        '</a>'
}

const friends_json = "https://api.bbing.com.cn/gistfriend?jsoncallback=?"
const uptime_robot = "https://api.bbing.com.cn/uptimerobot?jsoncallback=?"
const friends_arts = "https://rssblog.cn/bbing/?method=raw&jsoncallback=?"
const random_posts = "https://rssblog.cn/bbing/member/6bb5fc6102164251c8eda8d605698aa1/?method=raw&sample=1&count=6&jsoncallback=?"
function get_friends() {
    $.getJSON(uptime_robot, function (data) {
        monitors = eval(data["data"])
        $.getJSON(friends_json, function (data) {
            data = eval(data['data']);
            if (data.length < 1) return;
            status_ok = new Array();
            status_failed = new Array();
            for (var i = 0; i < data.length; i++) {
                for (var j = 0; j < monitors.length; j++) {
                    let furl = data[i]["url"].replace(/^http.*\/\//g, "").replace(/\//g, "");
                    let murl = monitors[j]["url"].replace(/^http.*\/\//g, "").replace(/\//g, "");
                    url_match = furl == murl;
                    status_match = monitors[j]["status"] != 0;
                    if (url_match) {
                        if (status_match) {
                            status_ok.push(data[i])
                        } else {
                            if (monitors[j]["score"] > 30)
                                status_failed.push(data[i])
                        }
                        break;
                    }
                }
            }

            // console.log(status_ok, status_failed);

            $('a[title="随机拜访一位朋友吧~"]').on("click", function () {
                let rand_id = Math.floor(Math.random() * status_ok.length);
                let target_url = status_ok[rand_id]["url"];
                window.open(target_url);
            });

            $('.frined-loading').remove();
            status_ok.sort(function () {
                return (0.5 - Math.random());
            });
            $.each(status_ok, function (infoIndex, info) {
                let friends = template_friend(info['url'], info['name'], info['word'], info['logo']);
                $('.friend-list-div.frind-real').append(friends);
            });
            if (status_ok.length > 0) {
                nextISU();
            }
            status_failed.sort(function () {
                return (0.5 - Math.random());
            });
            if (status_failed.length > 0) {
                $('h3#无法访问').css('display', 'block');
            } else {
                $('h3#无法访问').css('display', 'none');
            }
            $.each(status_failed, function (infoIndex, info) {
                let friends = template_friend(info['url'], info['name'], info['word'], info['logo'], "frined-url-noreach");
                $('.friend-list-div.frind-real-noreach').append(friends);
            });
        })
    })
}

function readerMode() {
    $('header').toggleClass('reader-mode');
    $('footer').toggleClass('reader-mode');
    $('.post-meta').toggleClass('reader-mode');
    $('.post-footer').toggleClass('reader-mode');
    $('.orlike-box').toggleClass('reader-mode');
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

offercode_tips_idx = 0;
offercode_tips = [
    '多思考几种方法！',
    '考虑时间复杂度和空间复杂度！',
    '别忘了边界条件！',
    '需不需要异常处理呢？',
    '能不能修改输入数据呢？',
    '可以申请额外的内存空间吗？',
    '在纸上画一画图吧~',
];
offercode_tips.sort(function () {
    return (0.5 - Math.random());
});

function offerCardTips() {
    $('.offercard-tips').text(offercode_tips[offercode_tips_idx]);
    offercode_tips_idx++;
    if (offercode_tips_idx >= offercode_tips.length) {
        offercode_tips_idx = 0;
    }
}

function activeOfferCard() {
    function consIssue(idx) {
        // console.log('get issue', idx, offercode_issues[idx]);
        return '### Q. ' + (idx + 1) + '\n---\n' + offercode_issues[idx]['des'];
    }

    function printIssue(idx) {
        let md = marked.parse(consIssue(idx));
        $(".offercode-card").html(md);
    }

    function getCurIdx() {
        let idx = localStorage.getItem("bbingblog-offercode-cidx");
        if (idx == undefined) {
            idx = 0;
        }
        idx = Number(idx);
        localStorage.setItem("bbingblog-offercode-cidx", idx);
        return idx;
    }

    function getNextIdx() {
        let idx = localStorage.getItem("bbingblog-offercode-cidx");
        if (idx == undefined) {
            idx = 0;
        } else {
            idx = Number(idx);
            idx += 1;
            idx = (idx >= offercode_issues.length) ? 0 : idx;
        }
        localStorage.setItem("bbingblog-offercode-cidx", idx);
        return idx;
    }

    function getPreIdx() {
        let idx = localStorage.getItem("bbingblog-offercode-cidx");
        if (idx == undefined) {
            idx = offercode_issues.length - 1;
        } else {
            idx = Number(idx);
            idx -= 1;
            idx = (idx < 0) ? (offercode_issues.length - 1) : idx;
        }
        localStorage.setItem("bbingblog-offercode-cidx", idx);
        return idx;
    }

    function unique(arr) {
        var res = [];
        var obj = {};
        for (var i = 0; i < arr.length; i++) {
            if (!obj[arr[i]]) {
                obj[arr[i]] = 1;
                res.push(arr[i]);
            }
        }
        return res;
    }

    function setPassIdx(idx) {
        let passidxes = localStorage.getItem("bbingblog-offercode-passidxes");
        if (passidxes == undefined) {
            passidxes = JSON.stringify([idx]);
        }
        passidxes = JSON.parse(passidxes);
        passidxes.push(idx)
        passidxes = unique(passidxes);
        localStorage.setItem("bbingblog-offercode-passidxes", JSON.stringify(passidxes));
        console.log("pass issues list", passidxes);
    }

    printIssue(getCurIdx());
    $('.offercode-ctrl-pre').on('click', function () { printIssue(getPreIdx()); });
    $('.offercode-ctrl-next').on('click', function () { printIssue(getNextIdx()); });
    $('.offercode-ctrl-pass').on('click', function () {
        setPassIdx(getCurIdx());
        printIssue(getNextIdx());
    });
    $('.offercode-ctrl-reject').on('click', function () { $('.offercode-ctrl-next').click() });
};

$(document).ready(function () {
    loop();
    setInterval(loop, 1000);
    get_friends();

    if ($(".offercode-card").length > 0) {
        loadExternalResource({ url: "https://cdn.staticfile.org/marked/4.0.16/marked.min.js", type: "js", onload: activeOfferCard });
        offerCardTips();
        setInterval(offerCardTips, 5000);
    }
    if ($("#dogdog").length > 0) {
        loadExternalResource({ url: "https://api.bbing.com.cn/dog?identify=dogdog&method=js", type: "js" });
    }
    if ($("#hitokoto").length > 0) {
        loadExternalResource({ url: "https://v1.hitokoto.cn/?encode=js&select=%23hitokoto&c=i", type: "js" });
    }
    loadExternalResource({ url: "https://hm.baidu.com/hm.js?19d1992f36a0a1272d7bf51277fb4fb0", type: "js" });

    if ($(".orlike-box").length > 0) {
        new OrLike({
            serverUrl: "https://orlike.api.bbing.com.cn/",
            el: ".orlike-box",
            days: 30,
            style: "https://fastly.jsdelivr.net/gh/caibingcheng/orlike@client/orlike.min.css",
            ifont: "https://fastly.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.13.0/css/all.min.css",
        });
    }

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

    if ($('article.page').length > 0) {
        $('#reader-button').css('display', 'block');
    }

    if ($('#build-timeline').length > 0) {
        $('#build-timeline').albeTimeline(buildtimeline, {
            effect: 'none',
            formatDate: 'MM-dd',
            showMenu: false,
            sortDesc: true
        });
    }

    if ($('#friends-articles').length > 0) {
        $.getJSON(friends_arts, function (data) {
            $('.friends-articles-loading').remove();
            data = eval(data);
            today = new Date();
            valid_links = data.filter(feed => feed["link"].search("bbing.com.cn") == -1 && new Date(feed['date']) <= today);
            valid_links = valid_links.slice(0, 10)
            valid_links.forEach(function (link) {
                let line = '<p class="friends-articles-line"><span>' + link['date'] + '  <a href="' + link['link'] + '">' + link['title'] + '</a></span>' +
                    '<span class="friends-articles-author">' + link['author'] + '</span></p>'
                $('#friends-articles').append(line);
            });
        });
    }

    if ($('#post-footer').length > 0) {
        const randpost = function () {
            $.getJSON(random_posts, function (data) {
                $('#my-random-posts').children().remove();
                valid_links = eval(data);
                $('#my-random-posts').append('<h3>随便看看</h3>');
                valid_links.forEach(function (link) {
                    let line = '<a href="' + link['link'] + '">' + '<p class="friends-articles-line my-random-posts">' + '<span>' + link['title'] + '</span>' +
                        '<span class="friends-articles-author">' + link['date'] + '</span>' + '</p></a>'
                    $('#my-random-posts').append(line);
                });
            });
        };
        randpost();
    }
})
