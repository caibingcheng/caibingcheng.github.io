# 开始使用Docker


本文主要介绍docker的基本使用方式。

## docker安装

<!--more-->

```shell
wget -qO- https://get.docker.com/ | sh
# 或者 apt install docker.io
docker --version
docker system info
```

如果遇到permission的问题，则将当前用户添加到用户组，并且之后要记得重新登录（注销当前用户）
```shell
$ sudo groupadd docker #创建docker用户组
$ sudo usermod -aG docker ${USER} #将当前用户加入docker用户组
$ sudo systemctl restart docker #重启docker服务
$ su root #切换到root用户，或注销再登录当前用户
$ su ${USER} #再切换到原来的应用用户以上配置才生效
```

## 下载镜像和运行、删除
```shell
docker search xxx //从docker hub查询xxx镜像
docker image pull xxx  //安装xxx镜像
docker container run xxx [cmd] //启动一个xxx容器，并在其中运行cmd命令
# 或者  docker run -it [image] [cmd]，可以-v映射本地路径到容器
docker images #查看当前docker客户端有哪些images
```
删除则是加上rm参数，不过多记录了

## 更多命令

一些命令可以参考    [这里](https://www.cnblogs.com/xiadongqing/p/6144053.html)

**善用help**
```shell
docker run -p [port in container]:[port in physical system] -d [image] [command] #端口映射
docker ps #类似于linux ps命令，查看在运行的container信息，-a 则是查看所有
docker stop [container] #停止container
docker kill [container] #同上，强制杀死
docker start/restart [container] #启动/重启container
docker update xxx [container] #可以更新container的一些标记
```

## Dockerfile
如果需要将一个应用容器化，则需要有一个Dockerfile来描述镜像的构建过程。

运行以下命令则可以读取Dockerfile，并将应用容器化

```shell
docker build -t [image-name] .  #要注意这里最后有一个点
# -t代表终端
# -i代表交互式命令
```
例如，以下
```shell
$ cat Dockerfile

FROM alpine
LABEL maintainer="nigelpoulton@hotmail.com"
RUN apk add --update nodejs nodejs-npm
COPY . /src
WORKDIR /src
RUN npm install
EXPOSE 8080
ENTRYPOINT ["node", "./app.js"]
```

镜像是一层一层构建的，一般新构建的镜像可以基于另外一个镜像上构建，比如上述例子，其镜像则基于alpine镜像构建。

- FROM 指令用于指定要构建的镜像的基础镜像。它通常是 Dockerfile 中的第一条指令。
- LABEL 打标签，是一个key-value对。
- RUN 在build时执行，每个 RUN 指令创建一个新的镜像层，所以应该把尽量多的执行命令放在一个RUN里面，这时候使用‘\’换行。
- CMD 在docker run时运行，且仅最后一条CMD有效。
- ENTRYPOINT 指令用于指定镜像以容器方式启动后默认运行的程序，类似于CMD。
- COPY 指令用于将文件作为一个新的层添加到镜像中。通常使用 COPY 指令将应用代码赋值到镜像中。
- ADD 同COPY，但是对压缩格式为 gzip, bzip2 以及 xz 的文件，会自动解压缩到目标路径下。所以如果不需要自动解压，则使用COPY。
- EXPOSE 指令用于记录应用所使用的网络端口。
- ENV 环境变量，也是key-value对。

其他的 Dockerfile 指令还有 ONBUILD、HEALTHCHECK 等。

在执行build时，按照顺序执行

1. 基于alpine镜像创建镜像
2. 设置label
3. 在alpine镜像中运行命令
4. 将当前路径文件 . 复制COPY到 apline 的 /src中
5. 设置alpine 的 /src 为工作目录，此时如果进入这个容器，则默认进入到/src 路径下
6. 设置端口
7. 设置默认app，如果运行docker run -it [image-name] 则默认执行该app，如果不指定则会进入容器交互式终端

基于以上，可以把一些项目打包成一个镜像，做到即开即用了。

## docker应用场景
> 在非web项目中，能不能用到docker呢？比如Android底层开发？

- 将本地文件映射（挂在到docker中）

详细：[这里](https://jf.ssjinyao.com/2020/03/31/Docker%E5%85%B1%E4%BA%AB%E5%AD%98%E5%82%A8-%E5%85%B1%E4%BA%AB%E6%95%B0%E6%8D%AE/)

```shell
#在eis容器中，将本地的eisdebugsite挂在到/www下
#端口映射，第一个8080是指docker对外映射的端口，客户端通过这个端口可以访问到服务器；第二个8080则是服务器对docker的内部端口，外部访问不到
docker container run -d -p 8080:8080 --name eisweb --volume /home/xx/project/eisdebugsite/:/www eis
```

## 离线安装与离线分享镜像

有些机器只能在内网环境下运行，不能也连不上外网，此时需要使用离线的方式构建docker环境。

- 下载离线docker bin
https://download.docker.com/linux/static/stable/x86_64/
具体参考[这里](https://www.cnblogs.com/luoSteel/p/10038954.html)

- 解压bin
```shell
tar -xvf docker-18.06.1-ce.tgz
```

- 将解压出来的docker文件内容移动到 /usr/bin/ 目录下
```shell
sudo cp docker/* /usr/bin/
```

- 将docker注册为service
```shell
sudo vim /etc/systemd/system/docker.service
```

- 将下列配置加到docker.service中并保存
```shell
[Unit]
Description=Docker Application Container Engine
Documentation=https://docs.docker.com
After=network-online.target firewalld.service
Wants=network-online.target

[Service]
Type=notify

# the default is not to use systemd for cgroups because the delegate issues still
# exists and systemd currently does not support the cgroup feature set required
# for containers run by docker
ExecStart=/usr/bin/dockerd
ExecReload=/bin/kill -s HUP $MAINPID

# Having non-zero Limit*s causes performance problems due to accounting overhead
# in the kernel. We recommend using cgroups to do container-local accounting.
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity

# Uncomment TasksMax if your systemd version supports it.
# Only systemd 226 and above support this version.
#TasksMax=infinity
TimeoutStartSec=0

# set delegate yes so that systemd does not reset the cgroups of docker containers
Delegate=yes
# kill only the docker process, not all processes in the cgroup
KillMode=process

# restart the docker process if it exits prematurely
Restart=on-failure
StartLimitBurst=3
StartLimitInterval=60s

[Install]
WantedBy=multi-user.target
```

- 启动，以下会需要选择用户，选择需要的用户即可
```shell
chmod +x /etc/systemd/system/docker.service    #添加文件权限并启动docker
systemctl daemon-reload                 #重载unit配置文件
systemctl start docker                  #启动Docker
systemctl enable docker.service         #设置开机自启
```

- 验证
```shell
systemctl status docker                 #查看Docker状态
docker -v                               #查看Docker版本
```

- 导出离线镜像
```shell
docker save [id] > xxx.tar
```

- 导入离线镜像
导入镜像需要先将本地对应的镜像删除
```shell
docker load < xxx.tar
```

## 能否在docker shell下使用Python等镜像？

> 目前遇到的问题是，在docker Python镜像下，我不能使用Python的交互式环境（-i -t），但是如果是Ubuntu镜像则可以使用Ubuntu的shell交互式环境。


