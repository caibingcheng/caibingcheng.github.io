# 进程控制和通信(五)


## socket通信应用

这是进程通信的最后一节. socket可以实现不同进程间的通信, 可以是相同机器的不同进程, 也可以是不同机器的不同进程.

本文的目的是简要学习socket通信的应用, 并且结合前几篇的内容, 学习socket通信的部分底层实现. 涉及到的一些api因为网上参考内容很多, 这里就不会介绍api的使用了.

<!--more-->

### utils

utils封装了```init```/```bind```和```connet```调用.

```C
// utils.h
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>

void init_socket(int *sock, struct sockaddr_in *serv_addr, const char* ip, const int &port)
{
    *sock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);

    memset(serv_addr, 0, sizeof(struct sockaddr_in));
    serv_addr->sin_family = AF_INET;
    serv_addr->sin_addr.s_addr = inet_addr(ip);
    serv_addr->sin_port = htons(port);
}

int bind_socket(const char* ip, const int &port)
{
    int sock;
    struct sockaddr_in serv_addr;
    init_socket(&sock, &serv_addr, ip, port);
    bind(sock, (struct sockaddr *)&serv_addr, sizeof(serv_addr));

    return sock;
}

int connect_socket(const char* ip, const int &port)
{
    int sock;
    struct sockaddr_in serv_addr;
    init_socket(&sock, &serv_addr, ip, port);
    connect(sock, (struct sockaddr *)&serv_addr, sizeof(serv_addr));

    return sock;
}
```

### server

server主要是监听端口, 收到客户端请求并且返回后, 继续监听.

```C
// server.cpp

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>
#include <netinet/in.h>

#include "utils.h"

int main(int argc, char **argv){
    int serv_sock = bind_socket(argv[1], atoi(argv[2]));
    listen(serv_sock, 1024);

    struct sockaddr_in clnt_addr;
    socklen_t clnt_addr_size = sizeof(clnt_addr);
    char say[1024];
    while(1)
    {
        int clnt_sock = accept(serv_sock, (struct sockaddr*)&clnt_addr, &clnt_addr_size);

        memset(say, 0, sizeof(say));
        read(clnt_sock, say, sizeof(say));
        printf("%s say: %s\n", inet_ntoa(clnt_addr.sin_addr), say);

        memset(say, 0, sizeof(say));
        printf("you say: ");
        char *s = fgets(say, sizeof(say), stdin);
        say[strlen(s) - 1] = '\0';
        write(clnt_sock, say, sizeof(say));

        close(clnt_sock);
    }

    close(serv_sock);

    return 0;
}
```

### client

客户端尝试连接服务端, 给服务端发送请求并且收到服务端的返回后, 则尝试下一次连接.

```C
// client.cpp

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <sys/socket.h>

#include "utils.h"

int main(int argc, char **argv)
{
    char say[1024];

    while (1)
    {
        int serv_sock = connect_socket(argv[1], atoi(argv[2]));

        memset(say, 0, sizeof(say));
        printf("you say: ");
        char *s = fgets(say, sizeof(say), stdin);
        say[strlen(s) - 1] = '\0';

        if (strcmp(say, "q") == 0) {
            break;
        }

        write(serv_sock, say, sizeof(say));

        memset(say, 0, sizeof(say));
        read(serv_sock, say, sizeof(say));
        printf("%s say: %s\n", argv[1], say);

        close(serv_sock);
    }

    return 0;
}
```

### 输出

首先启动server端
```Bash
$ ./server 127.0.0.1 7777
127.0.0.1 say: hi
you say: hi, i got you
127.0.0.1 say: bye
you say: byebye
```

然后启动client端
```Bash
$ ./client 127.0.0.1 7777
you say: hi
127.0.0.1 say: hi, i got you
you say: bye
127.0.0.1 say: byebye
you say: q
```

如果是同一局域网下的不同机器, 只要知道服务端的ip和监听端口就可以实现同一局域网不同机器之间的通信.

## socket

```socket```函数返回的是一个```int```型, 一般可以知道这大概是一个fd, 下面我们来挖一挖```socket```函数.

glibc给我们提供的```socket```函数调用的是```__sys_socket```.

```C
SYSCALL_DEFINE3(socket, int, family, int, type, int, protocol)
{
	return __sys_socket(family, type, protocol);
}
```

```__sys_socket```大致可以分为三个部分:

1. 处理flag
2. 创建```sock```
3. ```sock```和```file```关联

如下, 将处理flag部分暂时省略了, 这部分主要是一些mask的操作.

```C
int __sys_socket(int family, int type, int protocol)
{
	int retval;
	struct socket *sock;
	int flags;
	/* Check the SOCK_* constants for consistency.  */
	//......
	retval = sock_create(family, type, protocol, &sock);
	if (retval < 0)
		return retval;
	return sock_map_fd(sock, flags & (O_CLOEXEC | O_NONBLOCK));
}
```

```sock_create```创建了```sock```, 然后用```sock```和```file```关联, 并且返回一个fd. 下面继续看看```sock_create```和```sock_map_fd```.

### sock_create

```sock_create```会调用一个更复杂的```__sock_create```, ```__sock_create```可以区分是否是kernel的调用, 根据是否是kernel调用在创建```sock```的时候也会有区别.

#### __sock_create

```__sock_create```大概可以分为两部分, ```security_socket_create```和```sock_alloc```.

```security_socket_create```会关联一个hook函数, 这里就没有继续追踪下去了(TODO).

```sock_alloc```则会让```sock```和```inode```关联起来, 继续往下看.

```C
// __sock_create

err = security_socket_create(family, type, protocol, kern);
if (err)
	return err;
/*
	*	Allocate the socket and allow the family to set things up. if
	*	the protocol is 0, the family is instructed to select an appropriate
	*	default.
	*/
sock = sock_alloc();
// ......

rcu_read_lock();
pf = rcu_dereference(net_families[family]);
// ......

/* Now protected by module ref count */
rcu_read_unlock();
err = pf->create(net, sock, protocol, kern);
```

#### sock_alloc

```sock_alloc```大概分为三部分:
1. 在vfs的```super block```创建一个新的```inode```
2. 将新的```inode```扩展为一个```sock```(这部分比较有意思)
3. 对```inode```做一些初始化

对```inode```的初始化以下就省略了.

```C
// struct socket *sock_alloc(void)

inode = new_inode_pseudo(sock_mnt->mnt_sb);
if (!inode)
	return NULL;
sock = SOCKET_I(inode);
```

```new_inode_pseudo```暂且认为通过vfs根结点申请了一个```inode```, 并且返回. 接下来将这个```inode```输入给```SOCKET_I```.

```C
static inline struct socket *SOCKET_I(struct inode *inode)
{
	return &container_of(inode, struct socket_alloc, vfs_inode)->socket;
/*****
 * ({
 *  void *__mptr = (void *)(socket);
 *  ((struct socket_alloc *)(__mptr - __builtin_offsetof(struct socket_alloc, socket)));
 * })
*****/
}
```

```SOCKET_I```大概意思就是可以通过```inode```的地址得到```socket```的地址. 在这里```socket```和```inode```被放在同一个结构体```socket_alloc```下面, 所以可以通过```inode```找到```socket```是可以理解的.

目前遗留的问题是, 如果通过```inode```可以找到```socket```并且不发生内存越界, 这就意为着```socket```事先就已经分配好, 并且和```inode```放在一起了. 那么, ```socket```是什么时候分配的呢? (TODO)

```C
struct socket_alloc {
	struct socket socket;
	struct inode  vfs_inode;
};
```

以上, 我们拿到了```socket```结构体, ```socket```里面包含了什么? 如下:

```C
struct socket {
	socket_state			state;
	short					type;
	unsigned long			flags;
	struct socket_wq		*wq;
	struct file				*file;
	struct sock				*sk;
	const struct proto_ops	*ops;
};
```

比较有意思的成员有三个: ```file```/```sk```和```ops```.

- ```file```怎么和```socket```关联起来可以看下面的[sock_map_fd](#sock_map_fd).

- ```sk```指向了一个更复杂的```struct sock```结构体.

- ```ops```是sock的操作表, 规范了一些操作函数, 这种写法在最近的学习中已经见过很多次了. 如下是部分ops函数:
```C
const struct proto_ops inet_stream_ops = {
	.family		   = PF_INET,
	.owner		   = THIS_MODULE,
	.release	   = inet_release,
	.bind		   = inet_bind,
	.connect	   = inet_stream_connect,
	.socketpair	   = sock_no_socketpair,
	.accept		   = inet_accept,
	.getname	   = inet_getname,
	.poll		   = tcp_poll,
	.ioctl		   = inet_ioctl,
	.listen		   = inet_listen,
	.shutdown	   = inet_shutdown,
	// ......
};
```

### sock_map_fd

```sock_map_fd```大概分为两部分:
1. 找到一个空闲的fd
2. 生成一个新的```file```, 并且将fd和```file```关联

```C
static int sock_map_fd(struct socket *sock, int flags)
{
	struct file *newfile;
	int fd = get_unused_fd_flags(flags);
	if (unlikely(fd < 0)) {
		sock_release(sock);
		return fd;
	}
	newfile = sock_alloc_file(sock, flags, NULL);
	if (likely(!IS_ERR(newfile))) {
		fd_install(fd, newfile);
		return fd;
	}
	put_unused_fd(fd);
	return PTR_ERR(newfile);
}
```

#### sock_alloc_file

```sock_alloc_file```会创建一个新的```file```, 并且将```file```和```socket```关联:

1. sock->file = file;
2. file->private_data = sock;

```C
struct file *sock_alloc_file(struct socket *sock, int flags, const char *dname)
{
	struct file *file;
	if (!dname)
		dname = sock->sk ? sock->sk->sk_prot_creator->name : "";
	file = alloc_file_pseudo(SOCK_INODE(sock), sock_mnt, dname,
				O_RDWR | (flags & O_NONBLOCK),
				&socket_file_ops);
	if (IS_ERR(file)) {
		sock_release(sock);
		return file;
	}
	sock->file = file;
	file->private_data = sock;
	return file;
}
```

将```sock```和```file```关联, 就可以通过```file```找到对应的```sock```.
```C
struct socket *sock_from_file(struct file *file, int *err)
{
	if (file->f_op == &socket_file_ops)
		return file->private_data;	/* set in sock_map_fd */
	*err = -ENOTSOCK;
	return NULL;
}
```

### 小结

在创建```socket```的时候, 同时会创建```inode```和```file```, 将```socket```和```inode```以及```file```关联. 这样, 通过fd就可以找到```file```, 进而找到对应的```socket```. 由此, 我们也可以说, 对```socket```的操作就是对文件的操作.

## bind

```bind```调用的是```__sys_bind```.

```C
SYSCALL_DEFINE3(bind, int, fd, struct sockaddr __user *, umyaddr, int, addrlen)
{
	return __sys_bind(fd, umyaddr, addrlen);
}
```

```__sys_bind```大致可以分为三个部分:
1. 通过fd拿到```sock```
2. 将用户空间的参数移动到内核空间
3. hook调用监听```bind```

```C
int __sys_bind(int fd, struct sockaddr __user *umyaddr, int addrlen)
{
	struct socket *sock;
	struct sockaddr_storage address;
	int err, fput_needed;
	sock = sockfd_lookup_light(fd, &err, &fput_needed);
	if (sock) {
		err = move_addr_to_kernel(umyaddr, addrlen, &address);
		if (!err) {
			err = security_socket_bind(sock,
						   (struct sockaddr *)&address,
						   addrlen);
			if (!err)
				err = sock->ops->bind(sock,
						      (struct sockaddr *)
						      &address, addrlen);
		}
		fput_light(sock->file, fput_needed);
	}
	return err;
}
```

### sockfd_lookup_light

```sockfd_lookup_light```可以通过fd找到```sock```, 在[进程控制和进程通信(四)](/202105/process-ctracon4/)中, 我们已经学习了通过fd可以找到进程的```struct file```. 在上一节中, 我们又知道在创建```socket```的时候, ```socket```和```file```已经关联起来, 所以通过```file```又可以找到```socket```.

下面就是通过fd找到```socket```的函数.

```C
static struct socket *sockfd_lookup_light(int fd, int *err, int *fput_needed)
{
	struct fd f = fdget(fd);
	struct socket *sock;
	*err = -EBADF;
	if (f.file) {
		sock = sock_from_file(f.file, err);
		if (likely(sock)) {
			*fput_needed = f.flags;
			return sock;
		}
		fdput(f);
	}
	return NULL;
}
```

通过```file```找到```socket```, 在上一节已经看过这个函数了.

```C
struct socket *sock_from_file(struct file *file, int *err)
{
	if (file->f_op == &socket_file_ops)
		return file->private_data;	/* set in sock_map_fd */
	*err = -ENOTSOCK;
	return NULL;
}
```

### move_addr_to_kernel

将用户空间参数移动到内核空间, 如果参数长度太大, 则会报错.

为什么需要从用户空间移动到内核空间呢?

可以参考下一节[listen](#listen). 我认为是因为```listen```是在内核空间的, 为了**减少频繁的用户/内核的切换**, 所以在```bind```的时候就将用户空间的参数先复制到内核空间了.

```C
/**
 *	move_addr_to_kernel	-	copy a socket address into kernel space
 *	@uaddr: Address in user space
 *	@kaddr: Address in kernel space
 *	@ulen:  Length in user space
 *
 *	The address is copied into kernel space. If the provided address is
 *	too long an error code of -EINVAL is returned. If the copy gives
 *	invalid addresses -EFAULT is returned. On a success 0 is returned.
 */
int move_addr_to_kernel(void __user *uaddr, int ulen, struct sockaddr_storage *kaddr)
{
	if (ulen < 0 || ulen > sizeof(struct sockaddr_storage))
		return -EINVAL;
	if (ulen == 0)
		return 0;
	if (copy_from_user(kaddr, uaddr, ulen))
		return -EFAULT;
	return audit_sockaddr(ulen, kaddr);
}
```

### inet_bind

```bind```入参```struct sockaddr *uaddr```, 虽然写的是用户addr, 但是在上一小节的转换中, 这里的```uaddr```已经是内核空间的addr了.
```C
int inet_bind(struct socket *sock, struct sockaddr *uaddr, int addr_len)
{
	// ......
	/* If the socket has its own bind function then use it. (RAW) */
	if (sk->sk_prot->bind) {
		return sk->sk_prot->bind(sk, uaddr, addr_len);
	}
	// ......
	return __inet_bind(sk, uaddr, addr_len, false, true);
}
```

#### __inet_bind

```__inet_bind```大概可以分为两个部分:
1. 校验
2. 绑定

```C
int __inet_bind(struct sock *sk, struct sockaddr *uaddr, int addr_len,
		bool force_bind_address_no_port, bool with_lock)
{
	struct sockaddr_in *addr 	= (struct sockaddr_in *)uaddr;
	struct inet_sock *inet 		= inet_sk(sk);
	struct net *net 			= sock_net(sk);
	unsigned short 	snum;
	int 			chk_addr_ret;
	u32 			tb_id = RT_TABLE_LOCAL;
	// ......

	// 端口校验
	snum = ntohs(addr->sin_port);
	err = -EACCES;
	if (snum && snum < inet_prot_sock(net) &&
	    !ns_capable(net->user_ns, CAP_NET_BIND_SERVICE))
		goto out;
	// ......

	// 检查是否重复绑定
	if (sk->sk_state != TCP_CLOSE || inet->inet_num)
		goto out_release_sock;
	// ......

	// 开始绑定
	/* Make sure we are allowed to bind here. */
	if (snum || !(inet->bind_address_no_port ||
		      force_bind_address_no_port)) {
		if (sk->sk_prot->get_port(sk, snum)) {
			inet->inet_saddr = inet->inet_rcv_saddr = 0;
			err = -EADDRINUSE;
			goto out_release_sock;
		}
		err = BPF_CGROUP_RUN_PROG_INET4_POST_BIND(sk);
		if (err) {
			inet->inet_saddr = inet->inet_rcv_saddr = 0;
			goto out_release_sock;
		}
	}
	// ......
}
```

如上, 校验部分, 一是校验端口权限(端口ID很小时)和是否和法, 二是检查是否已经绑定过.

校验成功之后就开始执行绑定部分, 调用的是```get_port```函数. ```get_port```根据不同的协议簇会调用不同的绑定函数, 大体是将```socket```信息加入到一个hash表. (TODO: 端口绑定到底是怎么回事?)

### 小结

```bind```将ip地址和端口与```socket```绑定, 不同的协议簇会执行不同绑定函数. 在绑定之前, 会将绑定参数从用户空间移动到内核空间, 然后会检查绑定参数, 比如ip地址是否合法(支持), 端口是否合且是否有对应的权限可以操作, 也会检查是否是重复绑定. 检查过后就会将端口和```socket```绑定, 端口绑定会将参数送入内核空间的一个hash表. 端口可以重复绑定, 需要修改hash表对应value的值, 也可以实现自动绑定, 内核可以随机一个可以绑定的端口给```socket```实现绑定.

## listen

```listen```调用的是```__sys_listen```.
```C
SYSCALL_DEFINE2(listen, int, fd, int, backlog)
{
	return __sys_listen(fd, backlog);
}
```

```__sys_listen```大概可以分为三部分:
1. 通过fd找到```sock```
2. 设置```sock```连接的最大数
3. hook调用监听```sock```

```C
int __sys_listen(int fd, int backlog)
{
	struct socket *sock;
	int err, fput_needed;
	int somaxconn;
	sock = sockfd_lookup_light(fd, &err, &fput_needed);
	if (sock) {
		somaxconn = sock_net(sock->sk)->core.sysctl_somaxconn;
		if ((unsigned int)backlog > somaxconn)
			backlog = somaxconn;
		err = security_socket_listen(sock, backlog);
		if (!err)
			err = sock->ops->listen(sock, backlog);
		fput_light(sock->file, fput_needed);
	}
	return err;
}
```

### inet_listen

[```listen```最终调用到```inet_listen```](https://blog.csdn.net/zhangskd/article/details/14446581). 大致分为两部分:
1. 准备
2. 开始监听

```C
int inet_listen(struct socket *sock, int backlog)
{
	struct sock *sk = sock->sk;
	// ......
	sk->sk_max_ack_backlog = backlog;

	/* Really, if the socket is already in listen state
	 * we can only allow the backlog to be adjusted.
	 */
	if (old_state != TCP_LISTEN) {
		/* Enable TFO w/o requiring TCP_FASTOPEN socket option.
		 * Note that only TCP sockets (SOCK_STREAM) will reach here.
		 * Also fastopen backlog may already been set via the option
		 * because the socket was in TCP_LISTEN state previously but
		 * was shutdown() rather than close().
		 */
		tcp_fastopen = sock_net(sk)->ipv4.sysctl_tcp_fastopen;
		if ((tcp_fastopen & TFO_SERVER_WO_SOCKOPT1) &&
		    (tcp_fastopen & TFO_SERVER_ENABLE) &&
		    !inet_csk(sk)->icsk_accept_queue.fastopenq.max_qlen) {
			fastopen_queue_tune(sk, backlog);
			tcp_fastopen_init_key_once(sock_net(sk));
		}
		err = inet_csk_listen_start(sk, backlog);
		if (err)
			goto out;
		tcp_call_bpf(sk, BPF_SOCK_OPS_TCP_LISTEN_CB, 0, NULL);
	}
	err = 0;
out:
	release_sock(sk);
	return err;
}
```

#### inet_csk_listen_start

开始监听时, 可以看到, 会将```sock```加入到一个hash表中. 后续调用不再追踪下去, 根据我们的```socket```应用可以看到, ```listen```是不阻塞的, 所以```listen```在将```sock```塞入到hash表中之后, 就会返回. 那么结合上一节的结论, 我们基本可以知道, **监听hash表被系统内核维护**了.

```C
int inet_csk_listen_start(struct sock *sk, int backlog)
{
	struct inet_connection_sock *icsk = inet_csk(sk);
	struct inet_sock *inet = inet_sk(sk);
	int err = -EADDRINUSE;
	reqsk_queue_alloc(&icsk->icsk_accept_queue);
	sk->sk_ack_backlog = 0;
	inet_csk_delack_init(sk);
	// ......
	inet_sk_state_store(sk, TCP_LISTEN);
	if (!sk->sk_prot->get_port(sk, inet->inet_num)) {
		inet->inet_sport = htons(inet->inet_num);
		sk_dst_reset(sk);
		err = sk->sk_prot->hash(sk);
		if (likely(!err))
			return 0;
	}
	inet_sk_set_state(sk, TCP_CLOSE);
	return err;
}
```

### 小结

```listen```首先通过fd拿到```sock```, 然后会根据系统设置以及用户设置确定连接的最大数. 根据```sock```的状态会决定是否进入监听, 以避免重复监听. 在监听时, 会将```sock```加入到一个监听hash表中, 并被内核维护.

## accept

```accept```会调用```__sys_accept```
```C
SYSCALL_DEFINE3(accept, int, fd, struct sockaddr __user *, upeer_sockaddr,
		int __user *, upeer_addrlen)
{
	return __sys_accept4(fd, upeer_sockaddr, upeer_addrlen, 0);
}
```

```__sys_accept```先是通过fd拿到```sock```, 然后创建一个新的```sock```并且创建一个```struct file```与之关联, 最后调用```accept```. 分为三步:
1. 通过fd拿到```sock```
2. 创建新的```sock```和```struct file```, 并且关联两者
3. 调用```accept```

```C
// __sys_accept4

sock = sockfd_lookup_light(fd, &err, &fput_needed);
// ......

newsock = sock_alloc();
if (!newsock)
	goto out_put;
newsock->type = sock->type;
newsock->ops = sock->ops;
// ......

newfile = sock_alloc_file(newsock, flags, sock->sk->sk_prot_creator->name);
// ......

err = security_socket_accept(sock, newsock);
if (err)
	goto out_fd;
err = sock->ops->accept(sock, newsock, sock->file->f_flags, false);
if (err < 0)
	goto out_fd;
// ......

out_put:
	fput_light(sock->file, fput_needed);
out:
	return err;
out_fd:
	fput(newfile);
	put_unused_fd(newfd);
	goto out_put;
```

### inet_accept

```accept```指向的是```inet_accept```函数.

```C
int inet_accept(struct socket *sock, struct socket *newsock, int flags,
		bool kern)
{
	struct sock *sk1 = sock->sk;
	int err = -EINVAL;
	struct sock *sk2 = sk1->sk_prot->accept(sk1, flags, &err, kern);
	if (!sk2)
		goto do_err;
	lock_sock(sk2);
	sock_rps_record_flow(sk2);
	WARN_ON(!((1 << sk2->sk_state) &
		  (TCPF_ESTABLISHED | TCPF_SYN_RECV |
		  TCPF_CLOSE_WAIT | TCPF_CLOSE)));
	sock_graft(sk2, newsock);
	newsock->state = SS_CONNECTED;
	err = 0;
	release_sock(sk2);
do_err:
	return err;
}
```

### 小结

```accept```会创建一个新的```sock```和```struct file```, 并且让两个关联起来. 尽管没有继续追踪下去, 但是也可以知道, ```accept```返回的与之连接的```sock```就是这里创建的```sock```. 这里我甚至猜想会涉及到一些信号函数, 继续往下看.

## connect

```connect```调用的是```__sys_connect```.
```C
SYSCALL_DEFINE3(connect, int, fd, struct sockaddr __user *, uservaddr,
		int, addrlen)
{
	return __sys_connect(fd, uservaddr, addrlen);
}
```
__sys_connect基本可以分为三步:
1. 通过fd拿到```sock```
2. 将用户参数用用户空间复制到内核空间
3. 调用```connect```

```C
int __sys_connect(int fd, struct sockaddr __user *uservaddr, int addrlen)
{
	struct socket *sock;
	struct sockaddr_storage address;
	int err, fput_needed;
	sock = sockfd_lookup_light(fd, &err, &fput_needed);
	if (!sock)
		goto out;
	err = move_addr_to_kernel(uservaddr, addrlen, &address);
	if (err < 0)
		goto out_put;
	err =
	    security_socket_connect(sock, (struct sockaddr *)&address, addrlen);
	if (err)
		goto out_put;
	err = sock->ops->connect(sock, (struct sockaddr *)&address, addrlen,
				 sock->file->f_flags);
out_put:
	fput_light(sock->file, fput_needed);
out:
	return err;
}
```

### inet_stream_connect

```connect```会调用到```inet_stream_connect```最终到```__inet_stream_connect```.

不同的协议簇有不同的```connect```实现, 这里是公共调用部分, 大概分为以下几步:
1. 预连接, 不同协议簇有不同实现
2. 等待连接

```C
int __inet_stream_connect(struct socket *sock, struct sockaddr *uaddr,
			  int addr_len, int flags, int is_sendmsg)
{
	struct sock *sk = sock->sk;
	// ......

	switch (sock->state) {
	// ......

	case SS_UNCONNECTED:
		err = -EISCONN;
		if (sk->sk_state != TCP_CLOSE)
			goto out;
		if (BPF_CGROUP_PRE_CONNECT_ENABLED(sk)) {
			err = sk->sk_prot->pre_connect(sk, uaddr, addr_len);
			if (err)
				goto out;
		}
		err = sk->sk_prot->connect(sk, uaddr, addr_len);
		if (err < 0)
			goto out;
		sock->state = SS_CONNECTING;
		// ......
	}
	timeo = sock_sndtimeo(sk, flags & O_NONBLOCK);
	if ((1 << sk->sk_state) & (TCPF_SYN_SENT | TCPF_SYN_RECV)) {
		int writebias = (sk->sk_protocol == IPPROTO_TCP) &&
				tcp_sk(sk)->fastopen_req &&
				tcp_sk(sk)->fastopen_req->data ? 1 : 0;
		/* Error code is set above */
		if (!timeo || !inet_wait_for_connect(sk, timeo, writebias))
			goto out;
		err = sock_intr_errno(timeo);
		if (signal_pending(current))
			goto out;
	}

	/* Connection was closed by RST, timeout, ICMP error
	 * or another process disconnected us.
	 */
	if (sk->sk_state == TCP_CLOSE)
		goto sock_error;
	// ......
}
```

### 小结

```connect```和```bind```有点像, 在demo部分我们也可以看到, ```conncet```和```bind```是在相同的顺序下调用, 即创建```socket```之后调用. 但是```connect```是用来连接服务端, 也会将用户参数从用户空间复制到内核空间, 然后根据不同的协议簇调用不同的连接参数. 通过函数名```inet_wait_for_connect```, 也大概可以知道, ```connect```是阻塞的, 直到连接成功. 此外, ```connect```中可以看到几处```signal_pending```调用, 猜测是因为```connect```是阻塞的以及```timeout```的存在, 所以可能需要临时处理一些信号函数.

## 总结

这篇文章的内容比较浅, 主要目的还是补齐进程通信的最后一个方法, socket通信.

不过总归是有收获的. 对于我这种非科班人员, 是第一次接触socket编程, 通过学习和撰写这篇文章, 大概可以了解socket编程的大概方式:

1. 服务端需要绑定和监听
2. 客户端则需要连接服务端

通过尽量的接触源码, 一是习惯了这种学习方式, 虽然源码挖的不是很深, 但是基本会养成看源码的习惯. 二是看这些源码, 也学习到了linux编程的一些思路, 比如操作表. 三是养成举证的习惯, 下的一些结论尽量在代码里找到证据, 当然有一些结论基本也可以通过已知条件推断出来.

本文以及进程通信系列的文章还遗留了很多TODO, 这些都还是需要我去了解的, 但是优先级不是很高. 最近的目的还是先了解全貌, 再去看看一些细节.
