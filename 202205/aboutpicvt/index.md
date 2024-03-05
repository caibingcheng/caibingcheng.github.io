# 图床转换工具-picvt


本站图传切换过程：路过图床->github->本地->去不图床。

在这过程中, 我使用的是[`picvt`](https://github.com/caibingcheng/picvt)用来切换图床, 该项目还在开发中, 因为我没有使用过很多图床, 所以目前仅支持上述几种。

<!--more-->

项目传送门: [https://github.com/caibingcheng/picvt](https://github.com/caibingcheng/picvt)

### 构建

为了未来的适配工作, `picvt`规定了一些接口, 分别是用于链接提取的`extract`, 用于下载的`download`, 用于上传的`upload`。

#### 创建平台适配类

如果是新增平台, 比如新增xx图床, 则在`platforms/picvt_xxxx.py`创建对应平台的文件, 然后实现一个名为`Porcess`的类, 继承自`PICVT`, 如:
```Python
class Process(PICVT):
    pass
```

#### extract
需要实现一个名为`extract`的方法, 如:
```Python
def extract(self, content):
    return None
```
`extract`将用于原图床的链接提取, 输入是一段`string`, 比如一篇`markdown`的原始数据, 实现者需要从中提取出待转换的图床链接, 并使用一个`list`返回.

#### download
需要实现一个名为`download`的方法, 如:
```Python
def download(self, url):
    return False, None
```
`download`将用于原图床图片的下载, 并且需要将下载文件保存在本地磁盘, 其输入是原图床图片的链接, 输出是下载成功的状态以及保存的本地文件地址, 如果下载失败, 则本地文件地址为`None`.
父类`PICVT`中提供了`download`的实现, 但是不适用于所有平台, 所以特殊平台需要自己实现`download`方法.

父类`PICVT`也提供了`_save_image_default`和`_get_save_path`用于将图片存储到本地位置, 或者从本地位置获取图片, 提供统一的存储位置将便于`upload`方法的实现。

#### upload
需要实现一个名为`upload`的方法, 如:
```Python
def upload(self, path, params):
    return False, None
```
`upload`将用于新图床的上传, 输入参数为本地需要上传的文件的路径, 以及与图床登录相关的参数, 包括但不限于用户名/密码/token. 该方法将返回上传成功与否的状态, 以及新图床的外链, 如果上传失败, 则外链应该为`None`.

`params`的`config`字段可以提供很多与平台相关的参数, 比如与`github`等相关的`repo`、`branch`、`path`, 或者与`local`相关的`path`、`link`. 注意到不同平台有些字段是复用的, 但是意思不同, 比如`github`中的`path`代表`github`仓库中某路径, `local`中的`path`则代表本地某路径.

### 案例

更多案例可以参考[项目](https://github.com/caibingcheng/picvt), 或者使用`help`指令.

#### 从路过图床迁移到github

命令是:
```
python3 ./picvt.py -D ../blog/content/posts/ -F imgtu -T github -t **** --repo resources --branch main --path images
```

`-D ../blog/content/posts/`待扫描的路径, 将从上述路径中扫描符合imgtu规则的图片链接, `-F imgtu -T github`表示从`imgtu`迁移到`github`, `-t ****`则是`github`的`token`, 也可以使用用户名或者密码(未测试), `--repo resources --branch main --path images`则表示上传到`resources`仓库的`main`分支的`images`目录下.

上述指令执行完成之后会将`../blog/content/posts/`中的对应链接替换成`jsdelivr`的链接.


#### 从github迁移到本地

命令是:
```
python3 ./picvt.py -D ../blog/content/ -F github -T local --path /home/xxxx/projects/blog/content/statics/ --link /statics/ -r 3
```

`--path /home/xxxx/projects/blog/content/statics/`表示会将文件下载到`/home/xxxx/projects/blog/content/statics/`路径下, `--link /statics/`则是本地的链接前缀, 用于替换图片地址, 比如我的域名是`bbing.com.cn`, 则替换后访问图片链接将是`bbing.com.cn/statics/xxx.png`. `-r 3`则代表失败项会尝试3次, 如果还是失败了...在执行一次上述命令即可, 此时已经成功的链接是不会再重复处理的.

#### 从本地迁移到去不图床
命令是:
```
python3 ./picvt.py -D ../blog/content/ -F local -T 7bu --path /home/xxx/projects/blog/content/ --user xx@xx.com --paasswd *****
```

此处的`--path /home/xxx/projects/blog/content/`时local作为from的需求参数，表示本地图片的存储路径（比如图片`/statics/text.png`存储在`blog/content/`下），`--user`和`--passwd`则是去不图床的用户名（邮箱）和密码。
