# rssblog的数据源-rssblog-source


rssblog最初版本: 在应用启动的时间检查一个rss list, 然后取抓取rss list的数据, 保存在内存中.

<!--more-->

(至于为什么要做rssblog, 可以参考[这里](https://www.bbing.com.cn/202107/rss-rssblog).)

以上, 会有一些问题:

1. 如果rss list比较大的时候, 会影响服务的性能;
2. 不能做到缓存/保存历史数据;
3. 不能进行更复杂的操作;
4. 其他;

基于以上问题, 通过github action服务(白piao)为rssblog定制了数据源的服务-rssblog-source.

我们需要解决什么问题呢?

1. 可以缓存历史数据;
2. 有能力分析博文数据;

## 获取数据

首先明确我们的设备, 是github action, 白piao的我们才有可能保证长久运行, 而不至于因为资金等问题中断.

同原始版本, 也有一个rss list, 用于存放需要拉取的rss链接, 如下:
```
https://gist.githubusercontent.com/caibingcheng/adf8f300dc50a61a965bdcc6ef0aecb3/raw/rssblog-source-list.json
```
其内容如下:
```
{
    "bbing": "https://gist.githubusercontent.com/caibingcheng/adf8f300dc50a61a965bdcc6ef0aecb3/raw/friends.json",
    "addition": "https://gist.githubusercontent.com/caibingcheng/adf8f300dc50a61a965bdcc6ef0aecb3/raw/addition.json"
}
```
`rssblog-source-list.json`会指向一个json, 这个json中存放用户的rss列表, 因此, 可以支持不同的用户接入. 这里用户可以指博主, 博主可以将友链的rss整理成一个list, 填入上述json中即可.

例如, [https://gist.githubusercontent.com/caibingcheng/adf8f300dc50a61a965bdcc6ef0aecb3/raw/friends.json](https://gist.githubusercontent.com/caibingcheng/adf8f300dc50a61a965bdcc6ef0aecb3/raw/friends.json)会指向:
```
[
    "https://bbing.com.cn/index.xml",
    "https://lewky.cn/index.xml",
    "https://www.insidentally.com/atom.xml",
    "https://www.hin.cool/atom.xml",
    "https://7bxing.com/atom.xml",
    "https://coonaa.cn/index.php/feed",
    "https://thrower.cc/feed/"
]
```
这是我的博客中友链列表.

有了数据源后, 开始通过rss拉取文章列表和地址等信息.
```Python
url_hash = hash_url(rss)
df = pandas.json_normalize(rss_link)
if len(df) <= 0:
    print("fetching skip", r, "to", url_hash,
            "size", len(rss_link), len(df))
    continue
rss_dir = rss_fetch_source_dir + url_hash + "/"
if not os.path.isdir(rss_dir):
    os.makedirs(rss_dir)
df.to_csv(rss_dir + "new.csv", index=False,
            sep=",", encoding="utf-8")
```
计算rss链接的md5值, 作为本地保存的路径, 拉取数据保存为csv文件. 这里是原始数据, 还没有合并/去重/分类的操作.

拿到原始数据后, 可以先进行一些操作:

将以上的原始数据合并, 则可以得到所有的文章列表. 由此, 可以实现**rssblog的基本功能**, 预览所有文章的标题.

其次, 可以按照时间分类, 将`Year-Month`做成文件夹, 将对应的数据存在这些文件夹中. 由此, 可以实现**rssblog的时间分类功能**.

还可以按照博主分类, 可以实现**rssblog的博主分类功能**.

还可以按照数据源分类, 可以实现**rssblog的源分类功能**.

以上操作还不能保留以前拉取的数据, 并且上述都是临时数据(从rss list里面拉取和分类的).(对应`fetch_*.py`) 所以我们还需要一个地方保存最终的目标数据.

将以上数据按照对应目录保存在`__tmp__`, 然后merge到目标目录`public`, 对应`merge_*.py`.

```Python
merge_source(rss_out_source_dir, rss_fetch_source_dir)
merge_all(rss_out_all_dir, rss_fetch_all_dir)
merge_member(rss_out_member_dir, rss_fetch_member_dir)
merge_date(rss_out_date_dir, rss_fetch_date_dir)
merge_user(rss_out_user_dir, rss_fetch_user_dir)
```

目前采用比较笨的merge方法, 读取`__tmp__`和`public`对应路径的所有数据, 然后合并, 去重, 排序, 再存入到`public`. 这样在未来数据量增加时会有性能问题. 不过目前也就`<10MB`的数据, 数据增量也很小, 所以暂时不关心这个问题.

拉取和合并数据时, 每个独立分类下都有完整的数据, 比如源分类里面有所有的数据, 时间分类里面也有所有的数据, 如此会有很多的冗余, 能不能合并一起呢? 我认为是不行的, 因为没有高效的查找功能. 如果所有数据合并在一起, 我们就需要根据某个数据的index去这个合集里面查找, 对于vercel/github仓库来说, 这一点都不友好, 涉及太多IO. 所以, 当前设计是在每个分类下都有完整的数据, 因而在rssblog拉取数据时, 按照页为单位拉取, 比如第一页, 就是对应目录下的`1.csv`, 这样就可以只涉及一次IO操作, 尽管会有数据冗余, 也是可以接受的.

以上, 目前采取每天`0/12/18`点更新的策略.

## 备份博文

有时候会担心某个博主突然关站了, 怎么办? 所以考虑到需要备份文章的原始数据.

这时候需要考虑后期的维护成本, 比如源数据可能很大, 也不要对站长造成流量上的困扰, 所以目前仅是`get`原文的数据, 如果站长有反爬策略, 则可能不会`get`到目标数据.

这部分后续还会更新, 可能会伪装一下, 但是...也不太好, 有些站长不知道会不会愿意.

源博文的其他数据, 例如图片/视频等暂时不会拉取. 不拉取媒体资源, 一是出于流量的考虑, 二是考虑维护成本, 三是考虑数据容量, 仅量避免github仓库溢出(其实可以考虑多个仓库的策略, 这样几乎就没有容量上限了).

文章数量太多时, 会触及github仓库的文件数量上限, 所以目前在action服务上拉取文章后, 会将所有文章归档, 保存为一个文件, 后续向其中更新/添加新文件即可. 当然, 这里也有其他解决方法, 比如参考git的blob保存策略, 将`get`下来的数据的文件名保存为md5值(实际上是按照文章链接和最后更新的timestamp计算的md5, 这样可以尽量保证保存的是最新的数据), 可以将md5分成三组(其他数量也行), 然后第一组作为一级目录, 第二组作为二级目录, 第三组作为文件名. 这样, 可以尽量减少每个目录下的文件数量. 这部分后续会更新.

另外, 在源仓库根目录下需要保存源文的一些信息, 比如文件地址/题目/作者等等, 这样就容易通过外部服务访问备份数据. 当然, 在rssblog上这部分接口还没有添加, 近期也不会考虑添加, 因为目前各位的博客看起来都很健康, 应该不会出现退网的情况.(其实就是懒.)

这部分对应的源码在`backup_*.py`, 以下是对应源文拉取的部分, 会尝试拉取3次, 以尽量避免网络波动等问题造成的拉取失败:

```Python
@repeat(3)
def download_article(backup_stats):
    keys = backup_stats.loc[backup_stats['path']
                            == '-', ['key', 'link']].to_numpy()
    if len(keys) == 0:
        return
    print("backup", len(keys), "links waiting for download")

    def failed_backup(requests, exceptions):
        print("backup failed", requests, exceptions)
        return None

    if not os.path.exists(BACKUP_PATH):
        os.makedirs(BACKUP_PATH)

    lens = len(keys)
    batch = 100
    for s in range(0, lens, batch):
        keys_batch = keys[s: s + batch]
        reqs = [grequests.get(key[1], timeout=5.0)
                for key in keys_batch]
        print("backup request batch size: %d" % len(reqs))
        resp = grequests.map(reqs, exception_handler=failed_backup)

        for i, response in enumerate(resp):
            if not response:
                continue
            path = os.path.join(BACKUP_PATH, keys_batch[i][0] + ".html")
            with open(path, 'w') as f:
                f.write(response.text)
                backup_stats.loc[(backup_stats['key'] ==
                                  keys_batch[i][0]), 'path'] = '+'
                f.close()
```
可以看到, 文章被正常拉取并保存后, 会更新`path`的值, 这里的`path`表示当前文章的状态, 比如'+'表示已经拉取并保存, '-'表示还未拉取, 如果还有其他步骤的话, 可以继续添加, 这样可以减少一些重复的工作.

以上, 目前采取每周六`4`点更新的策略.

## 分析数据

这部分是设想, 未来有时间会做的. 有了原始数据, 我们可以做更多的事情. 比如:
1. 某些博主关站后, 我们还能访问他们原来的文章内容; (如果对方允许的话)
2. 可以提取博文关键词, 自动生成rssblog的关键词云;
3. 提供最新文章的接口, 这样可以应用在友链页面, 及时获取朋友们的最近更新;
4. 其他;

目前在做的部分是关键词云, 但是关键词的准确性还有些问题. 解决完关键词问题后就可以按照关键词分类, 也可以实现搜索功能.

