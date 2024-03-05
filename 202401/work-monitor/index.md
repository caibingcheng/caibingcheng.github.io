# Work Monitor 视频监控工具


已经很久沒有更新博客，主要是现在工作太忙，一天压得比较紧，回家之后就就没有太多精力去写博客了。

最近更新了一个Python工具，主要是用来视频监控。基本想法是通过延时摄影的方式，每隔一段时间拍摄一张照片，然后组合成视频，这样就可以看到一段时间内的变化。

<!--more-->

想做这个工具是因为我的电脑不太方便关或者锁屏，所以一般是打开的状态，但是我又想知道在我不在的时候，我的电脑有没有被别人使用，所以就想到了这个工具。目前处于可以使用的状态，后续我想加一些检测功能，比如检测到非自己的人脸就提高检测频率之类的，或者考虑视频压缩，可以减少一些重复、静态帧。

### 安装

相关的包已经上传到了pypi，可以通过pip安装。依赖的包有opencv-python，numpy。

```bash
pip3 install work-monitor
```

或者通过源码直接使用。

```bash
git clone git@github.com:caibingcheng/work-monitor.git
cd work-monitor
python3 -m monitor
```

### 使用

首先是启动监控服务。

```bash
work-monitor server
```

然后可以通过客户端来设置或查看服务端的状态，比如查看服务端的配置。

```bash
work-monitor get_config
```

或者设置服务端的配置。

```bash
work-monitor set_config <keys...> <value>
```

help命令可以查看更多的命令。

```bash
$ work-monitor help
Usage: python3 -m monitor <command> [arguments]
Commands:
    help: Print help
    server: Start server [video_path], default video_path is empty
    stop: Client command, stop server
    restart: Client command, restart server
    get_config: Client command, get config
    set_config: Client command, set config
```

### 代码讲解

源码地址： [https://github.com/caibingcheng/work-monitor](https://github.com/caibingcheng/work-monitor)

几个模块分类如下：

- app.py: 入口，调用command模块
- command.py: 命令行模块，在其中配置该项目支持的命令
- config.py: 配置模块，用于配置服务端的配置
- server.py: 服务端模块，用于启动服务端，客户端和服务端的通信也在其中实现
- log.py: 日志模块，用于记录日志
- capture.py: 拍照模块，用于拍照和保存图片
- video.py: 视频模块，用于将图片组合成视频
- policy.py: 策略模块，用于配置拍照和视频的策略，比如拍照的间隔时间，视频的长度等

#### 入口

主要关注server的入口。

```python
@add_command("server", "Start server [video_path], default video_path is empty")
def server(*args):
    log_info("Starting")
    policy = config["policy"]
    log_info(f"Using policy {policy}")
    # str to function
    policy = globals()[policy]

    from monitor.server import start_server, should_stop

    start_server()
    video_path_for_debug = "" if len(args) == 0 else args[0]
    while not should_stop():
        try:
            policy(video_path_for_debug)
        except Exception as e:
            log_error(e)
            # backtrace
            import traceback

            traceback.print_exc()
            stop()
    log_info("Stopped")
```

先找到policy，然后启动命令监听的server，然后执行对应的policy。如果发生异常时，会给server发送stop命令，然后退出。（这里有问题，如果是server异常，则命令不一定能发送到server，所以需要改进。）

#### 配置

原始配置如下：

```python
raw_config = {
    "camera_id": 0,
    "video_dir": "$HOME/Videos",
    "frames_dir": "$HOME/Pictures/work-monitor",
    "config_dir": "$HOME/.work-monitor",
    "log_dir": "$HOME/.work-monitor/log",
    "fps": 60,
    "quality": 75,
    "frames_save": False,
    "policy": "easy_policy",
    "easy_policy": {"frames_interval": 10, "frames_per_video": 1000},
    "server": {
        "port": 22311,
    },
}
```

各项配置的含义如下：

- camera_id: 摄像头id，如果有多个摄像头，可以通过这个配置来选择摄像头
- video_dir: 视频保存的目录
- frames_dir: 帧图片保存的目录
- config_dir: 配置文件保存的目录
- log_dir: 日志保存的目录
- fps: 视频的帧率
- quality: 帧图片的质量，取值范围[0, 100]，0表示最差，100表示最好
- frames_save: 是否保存帧图片，一般设置为False，因为帧图片会占用很大的空间
- policy: 策略，目前只有easy_policy，后续可以添加更多的策略
- easy_policy: easy_policy的配置，包括帧图片的间隔时间和视频的长度
- server: 服务端的配置，目前只有端口号

{{< admonition type=tip title="提示" open=true >}}

对于frames_save配置目前还有一些问题，如果设置值为True，并且policy是通过帧图片数判断是否要保存视频的话，则在第一次触发阈值之后会频繁触发且保存相同的帧。

{{< /admonition >}}

配置是通过一个全局变量config来保存的，初始化流程如下：

```python
try:
    config = initialize_config(config)
    verify_config(config)
except Exception as e:
    print(e)
    choise = input("Reset config? (y/n)")
    if choise == "y":
        print("Resetting config")
        config = raw_config
        config = initialize_config(config, force=True)
    else:
        print("Using raw config")
        config = raw_config
config = preprocess_config(config)
verify_config(config)
```

initialize_config会对原始的config作预处理，替换其中的环境变量，比如$HOME；判断值范围是否正确，比如quality的值范围是[0, 100]，如果不在范围内，则会抛出异常；创建目录，比如video_dir，frames_dir等；如果是第一次启动，则会将配置写入到文件。预处理之后会调用verify_config来验证配置是否正确，主要是检查config和raw_config的key是否一致，如果不一致，则会抛出异常。

当有异常的时候会尝试用raw_config来初始化config，如果用户允许的话，会覆盖掉原来的配置文件。

在server中可以动态更新参数，对应的修改会更新到配置文件中。

```python
@add_server_command("set_config")
def set_config_server(*args):
    if len(args) < 2:
        raise Exception("Not enough arguments")
    current = config.copy()
    current_header = current
    keys = args[:-1]
    value = args[-1]
    for key in keys[:-1]:
        if key not in current or not isinstance(current[key], dict):
            raise Exception(f"Key {key} not found")
        current = current[key]
    current[keys[-1]] = value
    current_header = initialize_config(current_header, force=True)
    config_str = json.dumps(current_header, indent=4).encode("utf-8")
    log_info(f"Sending config {config_str}")
    update_config(config, current_header)
    return config_str
```

比如设置video_dir。

```bash
work-monitor set_config video_dir /home/bing/Videos
```

#### 通信

server在主线程中启动，在子线程中监听客户端的连接。

```python
def start_server():
    # create a socket object
    serversocket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    # get local machine name
    host = socket.gethostname()
    port = config["server"]["port"]

    # force to release the port
    serversocket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    # set keep alive
    serversocket.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
    serversocket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 1)
    serversocket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 1)
    serversocket.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 5)

    # bind to the port
    serversocket.bind((host, port))

    # queue up to 5 requests
    serversocket.listen(5)

    def server_loop():
        log_info("Server started")
        while True:
            # establish a connection
            clientsocket, addr = serversocket.accept()
            log_info(f"Got a connection from {addr}")
            msg = clientsocket.recv(1024).decode("utf-8").split()
            log_info(f"Received {msg}")
            argument = msg[1:]
            msg = msg[0]
            try:
                if msg not in server_command:
                    log_error(f"Unknown command {msg}")
                    clientsocket.send("failed".encode("utf-8"))
                else:
                    clientsocket.send(server_command[msg](*argument))
            except Exception as e:
                # show backtrace
                log_error("Server failed", e)
                log_error("Config", config)

                clientsocket.send("failed".encode("utf-8"))
            finally:
                clientsocket.close()

    threading.Thread(target=server_loop).start()
```

客户端如下，是一般定式写法。

```python
def send_msg_to_server(msg):
    # create a socket object
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    # get local machine name
    host = socket.gethostname()
    port = config["server"]["port"]

    try:
        # connection to hostname on the port.
        client.connect((host, port))
    except Exception as e:
        log_error("Client failed to connect to server", e)
        exit(1)

    # Receive no more than 1024 bytes
    client.send(msg.encode("utf-8"))
    response = client.recv(1024).decode("utf-8")
    client.close()

    return response
```

#### 视频

拍照时，会将图片保存到frames_dir中，然后通过video模块来组合成视频。

```python
def generate_video():
    # only one video can be generated at a time
    global video_in_progress
    if video_in_progress:
        return

    log_info("Generating video")
    frames, frames_date_range = load_frames(config["frames_dir"])
    log_info(f"Total frames: {len(frames)}, date range: {frames_date_range}")
    if not frames:
        return

    video_in_progress = True
    import threading

    threading.Thread(
        target=generate_video_from_frames,
        args=(frames, frames_date_range, config["video_dir"], config["fps"]),
    ).start()
```

视频的生成是在子线程中进行的，考虑到一些边界情况，目前只允许一个视频生成线程在运行。

首先是检查frames_dir中是否有图片，如果没有则直接返回。然后将video_in_progress设置为True，表示有视频正在生成，然后在子线程中调用generate_video_from_frames来生成视频。

在检查frames_dir中是否有图片时，只是拿到图片的地址，此处不会读图，主要是考虑到frames_dir中的图片可能会很多，如果一次性读入内存，可能会导致内存不足，所以在生成视频的时候，会一张张的读入图片，然后组合成视频。

在图片保存的时候，会在图片中插入时间信息，这样在生成的视频中可以直观的看到时间信息。不过这样也会导致图片之间存在差异，不易于判断图片的相似度。（可以对相关区域做mask屏蔽。）

### 小结

总算更新了一篇博客，这个工具还有很多可以改进的地方，但是比如之前写的fstats、fkfish之类的工具在第一版之后就已经很久没有更新了，目前看起来也够用，总之随心所欲吧。也有几个其他的工具还在推进中，还没有成品，后续慢慢更新。

另外，感觉我这段时间有些闭塞，在制作这个工具的过程中，知道了以下更新：

- python3.10支持pyproject.toml了，并且setup.py是不推荐的了
- pypi用github action + twine发布会报错了，可以通过Trusted Publisher Management来管理发布者

不过，这段时间也不是废了，只是接触的领域不同。目前对DMA、Misra规则、QNX系统等等有一些接触和了解，也是扩展了自己的知识面，并且目前所在的激光雷达领域对我来说，就像是我在相机领域的延续，所以这也是缘分了。后续的年终总结中会想介绍介绍我的想法。

