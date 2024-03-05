# 使用GPG防止commiter冒充


Github/Gitlab等平台上，有添加GPG keys的选项，GPG keys有什么用呢？

如题，使用GPG认证可以防止commiter冒充。

<!--more-->

如何生成和管理GPG密钥对的详细过程可以参考阮一峰的[《GPG入门教程》](http://ruanyifeng.com/blog/2013/07/gpg.html)。

我们来简化过程（学会多用help和man）。

## 使用GPG

首先，生成一组密钥对：

```
gpg --gen-key
```

默认会使用RSA加密算法，根据提示输入需要的信息即可，比如姓名、邮箱。

然后查看生成的密钥对：

```
gpg --list-keys
```

得到类似以下信息：

```
------------------------------
pub   rsa3072 2022-09-28 [SC] [expires: 2024-09-27]
      DD723C3FC1B7322FEB3FD431C3238EDE9A24AC28
uid           [ultimate] caibingcheng <jack_cbc@163.com>
sub   rsa3072 2022-09-28 [E] [expires: 2024-09-27]
```

其中`DD723C3FC1B7322FEB3FD431C3238EDE9A24AC28`是我们需要用到的一段key，只是一段摘要信息，即使暴露也是安全的。

现在，需要导出该密钥对的public key：

```
gpg --armor --export DD723C3FC1B7322FEB3FD431C3238EDE9A24AC28
```

将得到如下类似的串：

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

...[此处是public key]
-----END PGP PUBLIC KEY BLOCK-----
```

复制上述段全部，接下来以Github举例。在Github GPG keys中导入该public key。在git配置中，先配置好默认的GPG签名密钥对：

```
git config [--global] user.signingKey DD723C3FC1B7322FEB3FD431C3238EDE9A24AC28
```

在作为修改后，尝试带上签名提交，如下(这样提交不是好的写法，仅做简写)：

```
git commit -a -sS -m 'update with signature'
```

(如果在生成GPG key的时候，输入了密码，那么在上述命令执行后是需要输入密码的。)

通过`git log`可以得到以下类似的提交信息，然后push到仓库：

```
Author: caibingcheng <jack_cbc@163.com>
Date:   Wed Sep 28 20:16:52 2022 +0800

    update with signature

    Signed-off-by: caibingcheng <jack_cbc@163.com>
```

提交后，就可以在Github的commits处看到有如下记录：

!["携带verify认证"](https://bu.dusays.com/2022/09/28/63343c38bfe62.png "携带verify认证")

如果不进行签名，那么就不会携带verify认证：

!["未携带verify认证"](https://bu.dusays.com/2022/09/28/63343d4085a2a.png "未携带verify认证")

## GPG防止commiter冒充

那么，GPG是如何防止commiter冒充的？在Github等平台上，可以通过上述verify标签判断是否真正的commiter。在PR阶段，仓库管理员就可以通过verify标签验证，来确定是否merge。（或者CI自动化判断也可以）

commiter如何被冒充？

因为git配置的时候，邮箱和用户名是可以随意修改，当其他人对你的仓库有提交权限的时候（比如一个开源仓库的开发人员），他就可以通过修改用户名、邮箱信息来冒充commiter。

这时候可能有些“不法分子”就会通过冒充commiter来博取信任，从而提交一些违规代码，或者扰乱项目正常进行。

通过GPG秘钥签名，保证物理安全，只要GPG私钥不泄露，那么一方面就可以保证代码是从真正commiter的设备上提交的；另一方面，通过设置签名密码，也可以加强commiter认证，降低被冒充的风险。

攻击者不是可以通过把他的GPG公钥放到Github GPG keys列表中来冒充吗？ →_→ 他都能破解你的Github账户了，那也没什么好防御的了~
