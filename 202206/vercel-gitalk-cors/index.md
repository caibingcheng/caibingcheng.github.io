# vercel反向代理解决gitalk跨域问题


又打开了评论...切换到了[gitalk](https://github.com/gitalk/gitalk)，原因是：

<!--more-->

1. 有评论比没评论好，如果朋友想交流的话则可以有联系方式
2. 此前使用[waline](https://github.com/walinejs/waline)，因为官方大版本升级，我本地尝试升级了一下，没有弄好，所以切换到了gitalk
3. gitalk配置相对简单，数据保存在github issue，相对长久和公开

以上。

gitalk如何配置网上可以搜到很多教程，基本都一致。

但是在配置验证时容易遇到“网络问题”， 如[Error: Network Error有好的解决方案吗](https://github.com/gitalk/gitalk/issues/506)。此问题的根本原因是github跨域访问导致，gitalk通过[https://cors-anywhere.azm.workers.dev/](https://cors-anywhere.azm.workers.dev/)等代理接口来解决CORS问题，但是以上代理接口容易被墙，因此比较好的方法是通过自建服务器来转发和接收请求。

参考[修改Gitalk代理地址，解决无法登录问题](https://apidocs.cn/blog/front/js/%E4%BF%AE%E6%94%B9Gitalk%E4%BB%A3%E7%90%86%E5%9C%B0%E5%9D%80%E8%A7%A3%E5%86%B3%E6%97%A0%E6%B3%95%E7%99%BB%E5%BD%95%E9%97%AE%E9%A2%98.html)，我实现了如下版本，与原版本基本无差，但是该版本理论上可以适配github其他接口的转发。

```python
import requests
import flask
from flask_cors import CORS

app = flask.Flask(__name__)
CORS(app, resources=r'/*')

@app.route('/github/<path:ghpath>', methods=["GET", "POST"])
def github(ghpath):
    url = 'https://github.com/{}'.format(ghpath)
    params = {
        'client_id': flask.request.json['client_id'],
        'client_secret': flask.request.json['client_secret'],
        'code': flask.request.json['code']
    }
    headers = {
        'accept': 'application/json'
    }
    result = requests.post(url=url, params=params, headers=headers, verify=False)
    return result.json()
```

更方便地，可以通过vercel帮助运行和执行该函数，因此在github上创建了[proxy-vercel](https://github.com/caibingcheng/proxy-vercel)，部署该函数后，在gitalk配置项中，将`proxy`项改为`https://[vercel_proxy_domain]/github/login/oauth/access_token`即可。
