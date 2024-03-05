# 文件和文件夹md5工具-md5any


这两天在整理博客的github action，仅期望在有修改的时候才会触发build&deploy，但是在实践过程中遇到一些问题，因此编写了md5any这个工具。

<!--more-->

## 背景

我遇到的问题是，我期望在content、theme等目录有修改的时候才会触发build&deploy的job，这里不方便使用last modified time来计算，因为github action的schedule触发时间是不确定的，用last modified time计算的话，会有一段模糊期（比如我是在+8时区的0点开始触发，那么这段时间是模糊期（我瞎编的名字）），容易遗落或者重复计算。

那么，我使用tar来计算，先将我期望观测的目录和文件归档成一个文件，然后计算该文件的md5值，通过比较md5来判断是否有更新。在本地测试结果很好，但是推送到github上测试时发现，每次触发action得到的归档包的md5值都不一样，很奇怪！我目前并没有找到针对该问题的解决方案，仅查询到一些零碎信息，比如tar如果使用gzip压缩，则可能每次压缩结果会不一样，因为这其中会涉及到一个随机数。不过我在上述操作过程中，并没有使用任何压缩，仅使用`-cf`指令创建归档文件，而且，本地测试每次打包的md5值是一样的，只是在github action上，该情况就不满足了。

## md5any

为了解决上述问题，那么我就尝试编写了md5any。linux提供的指令md5sum只可以计算文件的md5值。不过仔细想想，这是对的，因为文件夹（目录）的md5值是不好定义的。我是如何定义的呢？

我认为，文件夹的md5与其中文件的内容以及文件夹的目录结构有关，但是和最顶层文件夹无关，比如有这样的结构:
```
test/
├── d1
│   └── f1
├── d2
├── f1
└── f2
```
那么test这个文件夹的md5值和这些有关:
```
├── d1
│   └── f1
├── d2
├── f1
└── f2
```
和test自身的名字无关，这样的话，即时test名字改了，只要其目录结构以及文件内容不变（但是是否应该对文件属性敏感呢？比如文件修改日期之类？目前认为应该对其敏感），那么其md5值还是一样。

在这个前提条件下，就可以开始工作了：对于常规文件，计算其文件内容的md5值作为目标输出值；对于目录，则遍历其下的文件，计算文件md5值，然后与文件名、目录名一起作用再计算一个md5值作为其md5的结果，这是因为需要考虑文件在该目录下的位置，因此目录名和文件名需要考虑进去。可以参考以下代码（现在实验阶段，未来可能会变动）:

对常规文件，比如执行`md5any filename`则做以下操作：

```python
with Path(filepath).open('rb') as f:
    abs = hash(str(f.read()))
    if dentry is not None:
        abs = hash(str(dentry) + str(abs))
    return abs
```

对目录，比如执行`md5any dircname`则做以下操作：

```python
hashList = []
path = Path(dirpath)
for item in path.iterdir():
    if item.is_dir():
        hashList.append(self._hash_dir(str(item), str(item.name)))
    if item.is_file():
        hashList.append(self._hash_file(str(item), Path(dentry).joinpath(str(item.name))))
hashList.sort()
abs = hash(str(dentry) + ''.join(hashList))
```

（经[@qhw0](https://github.com/qhw0)提醒，将`os.path`替换为`pathlib.Path`）

对目录是考虑递归思路，文件内容的md5值和文件名以及所在目录名拼接为一个字符串，然后以该字符串计算新的md5值作为该目录下该文件的md5，把该目录下所有这样的md5值以字典序拼接为一个长字符串，再以该长字符串和该目录名拼接为一个新长字符串，再以该新长字符串的md5值作为上一级目录下该目录的md5值，以此递归。对根目录以`'.'`替代以表示对其不敏感。

这样做会有什么问题？我想的是，一个文件夹的md5被其子文件和子文件夹的md5值的拼接字符串经过再计算之后的md5代替了，相当于只需要这个文件夹下的一个包含某些字符串的文件经过计算也可以得到相同的结果。但是这个包含某些字符串的文件应该包含哪些内容？不太好计算。因为文件和文件夹的md5计算方式实际上有区别，文件会把上级目录考虑进去，而文件夹是只考虑自身的，这是有区别的。所以，如果只使用md5any计算，也没有太大风险，这和md5撞库可能是类似的（我没计算过概率）。

以上。最终期望是可以和md5sum一样的用法，但是增加对文件夹的支持，目前博客的github action使用该方法是好的，可以满足需求。
