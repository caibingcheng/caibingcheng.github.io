# 不同分支存储不同内容


## 本站结构

根目录下是hugo框架仓库, 使用了master分支, 同时还使用了以下子仓库:

<!--more-->


```Git
[submodule "themes/LoveIt"]
	path = themes/LoveIt
	url = https://github.com/dillonzq/LoveIt.git
[submodule "content"]
	path = content
	url = https://github.com/***********/blog.git
	branch = content
[submodule "live2d"]
	path = static/live2d
	url = https://github.com/***********/blog.git
	branch = live2d
```
注意到content和live2d其实和hugo框架在同一个仓库, 但是使用的是不同的分支.


PS: 这里的blog仓库是private的就不展示啦!

## 为什么这样做

目的是期望一个仓库管理一个项目, 上述content和live2d都是blog的一部分, 只是期望其内容分离, 互相不要有太多偶合.

网站配置一个分支, 文档内容一个分支, 这样之后迁移起来就很方便啦!

目前的结构:

| branch | content |
| :---- | :---- |
| master | hugo框架 |
| content | 文章源文 |
| live2d | live2d模型和配置 |

所以, 如果有需要, 我只需备份content分支就可以只备份文章内容了, 不会引入一些其他的干扰配置.

如果是有共同开发的分支, 可以起一个新的名字, 比如:

| branch | content |
| :---- | :---- |
| master | hugo框架 |
| master-feature1 | hugo框架-开发feature1功能 |
| content | 文章源文 |
| content-user | 投稿 |

本站在github上存储的是源码, 而不是hugo渲染之后的内容. 使用[CI/CD](/202103/git-cicd/)开发流程, 实现自动编译和部署, 用源码就够了. [看这里](/202103/git-cicd/).
