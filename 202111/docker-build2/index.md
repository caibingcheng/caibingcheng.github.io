# 使用Docker模拟软件运行环境


## 问题

在[《使用Docker构建不同平台编译环境》](/202101/docker-build)中, 模拟了不同系统平台的编译环境, 使得我们可以在某一个系统平台编译其他系统平台的内容.

最近遇到一个问题: 从AOSP拿到的heap_trace工具是使用glibc2.28及以上库编译的, 我本地的机器是ubuntu18.04, 使用的是2.27版本, 所以不兼容heap_trace工具. 但是查到ubuntu20.04更新了glibc版本, 然后想到了使用docker模拟ubuntu20.04环境.

<!--more-->

## Dockerfile

```dockerfile
FROM ubuntu:20.04
WORKDIR /scripts
RUN apt update && apt install -y python3 adb curl
```
使用ubuntu20.04镜像, 并且之后会将本地的测试脚本目录映射到容器的`/scripts`路径下. 镜像中也要记得安装脚本依赖.

## 构建镜像和容器
```shell
docker build -t heap_trace .
docker create -it --name heap_trace --privileged --volume /dev/bus/usb/:/dev/bus/usb/ --volume **/scripts/heap_trace/:/scripts heap_trace /bin/bash /scripts/heap_recording_new.sh
```

构建容器时需要注意将本地的usb设备映射到容器对应的路径下, `--volume /dev/bus/usb/:/dev/bus/usb/`, **容器访问Android设备时, 本地需要断开adb连接**, `adb kill-server`.

最后就可以运行容器了：
```shell
docker start heap_trace -i
```
