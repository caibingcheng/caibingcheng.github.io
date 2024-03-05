# 博客部署到vercel


本站同时部署到了阿里云oss和vercel, 境内ip一般访问的是阿里云, 境外ip一般访问的是vercel, 经过测试, 境外ip访问会有较大速度提升(最快从几百ms可以到几十ms).

<!--more-->

部署到vercel是将vercel项目和github page的仓库链接, 所以本站的源码或者博客内容提交后, 第一是会触发github action实现自动编译, 第二是将自动编译后的结果```./public```发布到阿里云oss和github page仓库, 此时会更新github page并会生成新的commit, 所以会触发vercel的自动部署函数.

内容推送到github page仓库需要使用deploy key, 源码仓库添加screte保存密钥, github page仓库添加deploy key保存公钥, 密钥对可以使用```ssh-keygen```生成.

为什么要使用github page触发vercel? 因为本站源码采用的是git submodule组织的形式, 内容/主题/插件/配置分别在不同的仓库或者分支, 目前使用vercel没有发现有很好的方法可以将这些内容组织起来, 所以曲线救国, 使用github page触发. 如果源码都在一个仓库的同一个分支, 则可以直接使用vercel部署, 不需要引入github page这一中间变量.

