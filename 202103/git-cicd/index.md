# 使用CICD自动部署


## github action

本站使用的是github action作为自动编译和部署工具.

为什么不使用Gitee的Gitee Go? 它是收费的...

<!--more-->

以下是本站的一个github action配置, 需要在.git同级目录建立.github/workflows/action.yml

功能是push master或者conten分支后, github自动使用hugo编译项目, 并且将编译后的项目推送到阿里云oss. 阿里云oss打开了静态网页配置, 如此就相当于直接更新网站了.
```
name: aliyun sso
on:
  push:
    branches:
      - master
      - content

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          ref: master
          submodules: true  # Fetch Hugo themes (true OR recursive)
          fetch-depth: 0    # Fetch all history for .GitInfo and .Lastmod

      - name: Update Content
        run: cd ./content && git pull origin content

      - name: Update Live2d
        run: cd ./static/live2d && git pull origin live2d

      - name: Setup Hugo
        uses: peaceiris/actions-hugo@v2
        with:
          hugo-version: 'latest'
          # extended: true

      - name: Build
        run: hugo --minify

      - name: Nojekyll
        run: touch ./public/.nojekyll

      - name: Deploy
        uses: fangbinwei/aliyun-oss-website-action@v1
        with:
            accessKeyId: ${{ secrets.KEYID }}
            accessKeySecret: ${{ secrets.KEYSECRET }}
            bucket: ${{ secrets.BUCKET }}
            # e.g. "oss-cn-shanghai.aliyuncs.com"
            endpoint: ${{ secrets.ENDPOINT }}
            folder: public

      - name: Post Urls
        run: . urls.sh
```
其含义:
- 使用aliyun oss (名字其是随便起, 但是有一定意义最好)
- 在push master或conten分支时会触发这个action
- 这个action的jobs运行在ubuntu环境下
- 这个action会拉取一些仓库和分支
- 这个action会调用其他的一些action实现编译和部署功能
- 这个action最后会调用一个urls.sh脚本(目前功能是将本站所有url更新到百度站长)

## gitlab CI/CD
这是我在gitlab上的一个项目的配置, 目的比较简单, 在项目更新到master分支后, gitlab会帮我做一些接口测试.

作为项目owner或者maintainer, 仅在merge request的CI通过时, 才会merge对应patch.
```
image: gcc
before_script:
  - apt-get update --yes
  - apt-get install --yes cmake

build:
  script:
    - cd ./build; cmake -DDEBUG=ON -DGUI=OFF -DTEST=ON ..; make -j2; cd ..
    - cd ./debug/bin/
    - /bin/bash testinterface.sh
  only:
    - master
    - web
```
其含义:
- 使用gcc docker image
- 在编译和部署之前会更新一些依赖
- 仅在master分支或者web操作更新时触发(push/merge等操作)

> 本文目的不是告诉怎么写CI/CD配置, 不同git服务可能不一样. 本文目的是告诉有这么一个东西, 具体按照需求自查即可.

