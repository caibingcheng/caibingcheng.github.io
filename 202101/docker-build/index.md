# 使用Docker构建不同平台编译环境


## 问题
需要构建不同平台的bin，但是本地电脑是ubuntu18的系统，怎么构建ubuntu16可用的bin呢？

<!--more-->

## 方案
使用docker, 是下是qt项目举例

### 编写Dockerfile

``` shell
FROM daocloud.io/library/ubuntu:16.04
VOLUME /nyuv/
RUN apt update && apt install -y make cmake gcc build-essential qt5-default
```

可以再更自动化一点

```shell
WORKDIR /nyuv/
CMD ["source", "build.sh"]
```

在build.sh里面编写build脚本即可

### 构建镜像
```shell
docker build -t nyuv .
```

### 挂载本地目录，构建容器并进入
```shell
docker run -it -v /home/xx/bin/nyuv/:/nyuv/ nyuv /bin/bash
```

至此，剩下操作如同本地编译一样
