# 有只猫


<script>
    var myCats = [
        {
            "url": "https://bu.dusays.com/2023/03/21/641949df21124.jpg",
            "log": "今天又是可爱的一天",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e21a404.jpg",
            "log": "什么? 小鱼干吃完啦!!!",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e1d0faa.jpg",
            "log": "你你你~ 想干嘛~~",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e1b0bfa.jpg",
            "log": "略略略",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e1521c9.jpg",
            "log": "看我脸色行事",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e144fa7.jpg",
            "log": "哈哈哈, 笑屎我了",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e0b3d5b.jpg",
            "log": "我一口能吃那么大!",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e03f109.jpg",
            "log": "",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949dfeddf7.jpg",
            "log": "",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e226f99.jpg",
            "log": "铲屎哒! 我醒啦!",
        },
        {
            "url": "https://bu.dusays.com/2023/03/21/641949e3add31.jpg",
            "log": "啊啊啊啊!我要掉下去啦!!!",
        },
    ];
</script>

<div>
    <img onclick="next()" src=""/>
    <p></p>
</div>

<script>
    var catImg = document.querySelector("#content > div > img");
    var catLog = document.querySelector("#content > div > p");
    myCats = myCats.sort(() => Math.random() - 0.5);
    var index = 0;
    function next() {
        if (index >= myCats.length) index = 0;
        let cat = myCats[index++];
        catImg.src = cat.url;
        catLog.innerHTML = cat.log;
    }
    next();
</script>
