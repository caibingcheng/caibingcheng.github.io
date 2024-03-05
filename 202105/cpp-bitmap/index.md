# 数据结构与算法之位图


## 问题

假设有一个数字流, 值域是[0, 4294967295], 每个值等概率随机出现, 现在需要设计一个算法判断某个数字有没有出现过.

<!--more-->

解决这个问题有几种思路:

1. 申请一个大小为4294967296的数组A, 初始化所有值为0, 每来一个数字n, 就给对应下标+1, 即A[n]++; 如果这个数组是bool类型, 那么将占用4GB内存空间.

2. 使用文件操作, 每来一个数字就去文件中查找是否存在, 如果不存在就将数字写入文件. 这样磁盘足够大, 但是会涉及到很多IO操作. 可以稍微优化一下, 比如用一个想对比较小的buffer作为缓存, 先将数字和buffer中的数字比较, 如果不存在就再和文件中的数字比较, 如果还是不存在, 就维护buffer长度, 将buffer的最后一个数字写入文件, 最新的数字加到buffer头.

3. 优化方案1, 如果可以将数字类型设置为bit, 那么就可以减少为1/8的空间, 这时候只需要512MB内存, 想对还可以接受.

方案3就是这里要介绍的位图. 可以认为位图就是一块buffer, 以bit为单位操作. 如果来一个新的数字, 比如n, 我们就需要计算n在位图中的下标, 这个下标可以用二维表示, 一个是所在的Byte下标, 一个是在Byte的偏移, 所以下标可以计算为(n / 8, n % 8).

## bitset

C++为我们提供了bitset的结构用于表示位图. 来看一段例子:

```C++
#include <iostream>
#include <bitset>

using namespace std;

int main() {
    bitset<8> bits;

    bits.set();             //11111111
    cout << bits << endl;
    bits.reset();           //00000000
    cout << bits << endl;

    bits[0] = 1;            //00000001
    bits[1] = 2;            //00000011
    cout << bits << endl;

    bits.flip();            //11111100
    cout << bits << endl;

    bits ^= 0xF1;           //00001101
    cout << bits << endl;

    bitset<65> bits1;
    cout << sizeof(bits) << endl;       //8
    cout << sizeof(bits1) << endl;      //16

    return 1;
}
```
[API手册](https://en.cppreference.com/w/cpp/utility/bitset)

了解这个结构即可, bitset还可以支持常规的位运算, 当做一个普通的类型处理即可.

需要注意的是, bitset以64b为单位申请内存, 比如声明bitset<8>时, bitset内部申请了64bits的内存, 声明bitset<65>时, bitset内部申请了128bits的内存.
