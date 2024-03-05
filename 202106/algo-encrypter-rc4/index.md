# RC4加密算法


RC4是一种对称加密算法，本文尝试使用这种加密算法来加密图片和文件。

<!--more-->

## Demo
- [在线demo](https://picrc.vercel.app/)
- [文件内容加密](https://github.com/caibingcheng/picrc)
- [图片内容加密](https://gitee.com/jerry323/RC4_picture)


## Code
```Python
class RC4():
    '''
    初始化部分，s盒初始化为0-255，k是秘钥流
    '''
    def __init__(self):
        self.s_box = [i for i in range(256)]
        self.k = [0 for i in range(256)]

    '''
    参数：
    key 秘钥， 长度为1-256
    ---
    用于打乱s盒，新的s盒将与秘钥有关
    '''
    def init(self, key):
        key_len = len(key)
        if (key_len > 256) or (key_len < 1):
            raise Exception("Keys length between 1-256!")

        # 秘钥流生成
        k = [ord(key[i % key_len]) for i in range(256)]

        # 开始打乱s盒
        j = 0
        for i in range(256):
            j = (j + self.s_box[i] + k[i]) % 256
            self.s_box[i], self.s_box[j] = self.s_box[j], self.s_box[i]

        return self.s_box

    '''
    参数：
    data 待加密数据
    ---
    用于加密数据，该方法使用前必须初始化，init与start分开有助于RC4加密的灵活使用
    '''
    def start(self, data, skip=False):
        i, j = 0, 0
        for k in range(len(data)):
            # 降低计算量, 可选
            if skip and ((k + i + j) % 7 > 0):
                continue
            i = (i + 1) % 256
            j = (j + self.s_box[i]) % 256
            self.s_box[i], self.s_box[j] = self.s_box[j], self.s_box[i]
            t = (self.s_box[i] + self.s_box[j]) % 256
            data[k] ^= self.s_box[t]
        return data
```
