# NAS-OMV容器配置

在[《闲置笔记本改NAS-omv踩坑记录》](/202204/laptopnas-omv/)简单介绍了我为什么要把废旧笔记本改NAS以及大致操作。但是最近给比较本换固态重新装系统的时候，发现之前的文章没法拿来就用，因此需要详细记录。本文主要内容是docker容器的配置工作，OMV基础配置并不涉及。

<!--more-->

### 升级

我使用作为NAS的机器是七年前的笔记本（Acer E5-572GMX），CPU是[i5-4210M](https://www.intel.cn/content/www/cn/zh/products/sku/81012/intel-core-i54210m-processor-3m-cache-up-to-3-20-ghz/specifications.html)，TDP大概在37 W。

只给笔记本换了一下系统硬盘，原来的系统盘是500G的机械硬盘，已经有七年的历史了，所以给换成了250G的固态硬盘。前文中已经提到过，如果使用OMV直接刷系统（不是通过先Debian再OMV），那么系统盘是无法直接作为存储盘的，因此不需要很大，只需要满足一些docker过kvm的空间即可。

因为将系统盘换成了固态盘，最明显的区别是，OMV反应速度变快了。在上面安装插件、安装docker的速度以及部分视频播放的流畅度有明显改善。

不过，笔记本是通过WiFi和家庭网络连接的，传输速度并不是很快，而且是14年产的笔记本，使用的是2.5G的WiFi，日常传输速度只有大概10MB/s。（很慢很慢了...）

因为网络速度瓶颈，目前也就刚刚够用的状态，大部分还是只能满足备份的需求。我测试过将游戏安装在上面（打开SMB），并不能正常游玩，会卡死。所以，下一步的硬件升级计划是提高网速。

至于为什么不用有线连接，一是因为记得购买的时候有说明有线网卡的速度是100Mbps，现在不方便升级，无线网卡更容易升级；二是因为现在租的房子有线网络有问题，家里所有设备现在都是使用无线网络连接的。

至于换什么网卡，还在考虑中，现在家里的路由器是WDR7650，目标是能跑满。如果未来速度满足需求的话，很多免装软件就可以直接放在远程硬盘上了。

再下一步是要升级（扩容）硬盘，但是我并不考虑raid阵列，使用硬盘柜扩充即可，目前还在调查中。

### docker compose

docker安装的几个服务主要是jellyfin、transmission、nextcloud，目前就这些，未来可能考虑openwrt，但是因为网络环境不太好，网速提不上去之前是不会考虑的。再下一个计划就是装上code server，这样在台式机或者笔记本上都可以写博客并且在线预览。（现在使用的是小书匠写，虽然体验很好，但是有在线预览需求，小书匠的预览效果和我的博客主题并不一样。）

公网IP暂时不考虑，内网穿透在计划中，但是不一定实施。

因为网上教程太杂，不容易成功，以下主要介绍几个docker compose的配置，是参考docker hub的配置的，基本只是修改了值。

#### jellyfin

jellyfin主要作为媒体库，体验过本地安装jellyfin和emby，实际感觉差不多，没有很明显的区别，因此还是使用docker安装。（而且docker也是号称不吃资源。）

```docker
---
version: "2.1"
services:
  jellyfin:
    image: lscr.io/linuxserver/jellyfin:latest
    container_name: jellyfin
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Shanghai
    volumes:
      - /srv/xxxxxxxxxxx/Medias/config:/config
      - /srv/xxxxxxxxxxx/Medias/movies:/data/movies
      - /srv/xxxxxxxxxxx/Medias/musics:/data/musics
      - /srv/xxxxxxxxxxx/Medias/pictures:/data/pictures
    ports:
      - 8096:8096
      - 8920:8920 #optional
      - 7359:7359/udp #optional
      - 1900:1900/udp #optional
    restart: unless-stopped
```

推荐`image`加上`latest`标签，这样下次更新的时候方便，我在电视上安装jellyfin的时候，就遇到过服务器版本太老导致电视jellyfin无法登陆的问题，因此将服务器版本保持最新也是有用的。

`PUID`、`PGID`两项主要是配置用户权限的，通过`id [user]`查看user的id和所属group id，主要是涉及对jellyfin目录的读写权限，或者是对驱动的读写权限，推荐权限不要给太高，满足即可。当然，只在家庭网络环境使用的话，问题也不是很大，但是也是可以学习学习权限配置的，控制好权限也没有那么简单。

`volumes`做目录影射，不细表，只有`/config`项是必须项，其他按照需求填写即可。

端口按照需求配置即可。

#### transmission

transmission主要用来当做下载器，可以下载bt种子和做种，挂着24h下就行了。

```docker
---
version: "2.1"
services:
  transmission:
    image: lscr.io/linuxserver/transmission:latest
    container_name: transmission
    environment:
      - PUID=1000
      - PGID=1000
      - TZ=Asia/Shanghai
      - TRANSMISSION_WEB_HOME=/transmissionic/ #optional
      - USER=********* #optional
      - PASS=********* #optional
    volumes:
      - /srv/xxxxxxxxxxx/Medias/config:/config
      - /srv/xxxxxxxxxxx/Medias/downloads:/downloads
      - /srv/xxxxxxxxxxx/Medias/downloads/transmission_watch:/watch
    ports:
      - 9091:9091
      - 51413:51413
      - 51413:51413/udp
    restart: unless-stopped
```

`TRANSMISSION_WEB_HOME`是用来配置主题的，我还是推荐`transmissionic`，挺漂亮的。

`USER`和`PASS`是用来设置登陆账户的，如果不设置该项，则使用transmission就不需要登陆。

`volumes`的`/watch`可以用来自动下载，将下载好的种子，放在`/watch`对应的目录下，即可实现自动下载。

#### nextcloud

我有纠结过nextcloud和SMB的区别是什么，其实功能上nextcloud就可以等同于onedrive。

以照片同步来说，如果使用SMB备份照片，则是将照片拖动到SMB映射的硬盘，然后等待复制进度条走完，如果复制失败了，则可能一张照片都没有备份过去。如果是nextcould，则是照片拖动过去，然后nextcloud自己负责一张一张地复制到“云端”，基本不会有某次失败导致全部失败的情况。

但是也有问题，比如nextcloud之类的会占用本地存储空间，需要同步完然后释放本地空间才可，而SMB移动过去之后就不会占用本地空间。另外通过SMB也可以将游戏之类的应用装在远程硬盘上，而不占用本地存储空间，使用nextcloud之类就可能很难实现该功能。使用nextcloud云盘的好处是，照片等媒体查看会比SMB协议方便和人性化很多，可以当做一个小的媒体服务器，如果是处理一些文档数据，我认为也很方便，因为可以在其他如手机、平板、Linux、Mac上处理，不会受到协议的限制。（当然，这里是不考虑三方平台的。）

所以，使用nextcloud的作用是，当做照片、文档跨平台查看和备份的工具。（今天正好在同步照片，没想到有20G，SMB可以当做冷备份。）

```
version: '2'

volumes:
  nextcloud:
  db:

services:
  db:
    image: mariadb:10.5
    restart: always
    command: --transaction-isolation=READ-COMMITTED --binlog-format=ROW
    volumes:
      - /srv/xxxxxxxxxxx/nextcloud/db:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=*********
      - MYSQL_PASSWORD=*********
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud

  app:
    image: nextcloud
    restart: always
    ports:
      - 8080:80
    links:
      - db
    volumes:
      - /srv/xxxxxxxxxxx/nextcloud/nextcloud:/var/www/html
    environment:
      - MYSQL_PASSWORD=*********
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_HOST=db
```

我目前在试用的方案是，手机上安装nextcloud，打开自动同步手机照片。尽管目前还只支持局域网，但是每天回到家，连上wifi就会自动同步/备份照片，这也是可以接受的。

---

> 以上很多密码，我是使用keepass作为密码管理工具，已经使用了差不多大半年了，支持跨平台很方便，并且keepass开源，号称是目前无法破解，可以推荐使用。Windows上的工具叫keepass2， Andriod上是keepass2andriod，iOS上的是fantasypass（注意，iOS暂未开源）。
