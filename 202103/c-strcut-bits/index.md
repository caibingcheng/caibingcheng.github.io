# struct位域


## struct位域
位域可以将成员变量拆分成bit的粒度. 用法一般是:

<!--more-->

```C++
identifier(optional) attr(optional) : size
```

例如以下:
```C++
struct BITS{
    uint32_t d1 : 4;
    uint32_t d2 : 4;
    uint32_t d3 : 4;
    uint32_t d4 : 4;
    uint32_t : 16;
};
```
```BITS```的成员```d1```/```d2```/```d3```/```d4```各占4bits, 最后还有16bit的保留位. 所以```sizeof(BITS)```的大小是4.

稍微改动一下, 去掉16bit的保留位:
```C++
struct BITS{
    uint32_t d1 : 4;
    uint32_t d2 : 4;
    uint32_t d3 : 4;
    uint32_t d4 : 4;
};
```
现在```BITS```的大小是2吗? 不是的, ```sizeof(BITS)```还是4.

再改动, 保留20bit空间:
```C++
struct BITS{
    uint32_t d1 : 4;
    uint32_t d2 : 4;
    uint32_t d3 : 4;
    uint32_t d4 : 4;
    uint32_t : 20;
};
```
现在```BITS```的大小是4吗? 不是的, ```sizeof(BITS)```是8.

以上, ```BITS```声明的位域数和不足```uint32_t```占位时, ```BITS```占位是```sizeof(uint32_t)```, 超过时, 这是```sizeof(uint32_t)```的整数倍. 这一点和```struct```保持一致.

再来改一笔, 把```uint32_t```改成```uint8_t```:
```C++
struct BITS{
    uint8_t d1 : 4;
    uint8_t d2 : 4;
    uint8_t d3 : 4;
    uint8_t d4 : 4;
};
```
现在```BITS```的大小是4吗? 不是的, ```sizeof(BITS)```是2.

如果把某个```uint8_t```改成```uint16_t```, ```sizeof(BITS)```依然是2, 如果改成```uint32_t```, 则```sizeof(BITS)```是4.

有以下结论:

> struct位域占用的大小总是其最大标识符的整数倍.

我们可以单独写入或者读出每个成员:
```C++
bit.d1 = 1;
bit.d2 = 2;
bit.d3 = bit.d1 | bit.d2;
```
如果成员比较多则比较麻烦, 这时候可以使用union.

## union初始化位域
```C++
union BITS{
    struct {
        uint32_t d1 : 4;
        uint32_t d2 : 4;
        uint32_t d3 : 4;
        uint32_t d4 : 4;
        uint32_t : 16;
    }u;
    uint32_t data;
};
```
我们可以直接初始化所有位域:
```C++
BITS bits;
bits.data = 0x0;
```
也可以通过```data```一次性设置所有位域:
```
bits.data = 0x12345678;
```
但是```data```和```d1-d4```的对应关系如何? 则需要考虑系统的小大端.

## 小大端模式
> 小端: 低位Byte存低地址, 高位Byte存高地址;
>
> 大端: 低位Byte存高地址, 高位Byte存低地址;

可用以下代码判断:
```C++
union MODE
{
    uint16_t i = 1;
    uint8_t small;
};
```
如果是小端, 则small为true, 否则small为false.

如果是小端存储:
```C++
bits.data = 0x12345678;
```
输出```d1-d4```则是:
```C++
d1=8;
d2=7;
d3=6;
d4=5;
```
如果是大端存储, 输出```d1-d4```则是:
```C++
d1=1;
d2=2;
d3=3;
d4=4;
```

了解小大端存储方式对开发有一定的帮助, 比如下面一个例子:

设计一个debug接口, 用户set一个属性, 系统通过获取这个属性可以支持不同的debug模式, 但是因为某些原因, 只允许设置一个属性, 值是32位.

此时我们就可以用上面的```BITS```. 获取```prop```:
```C++
BITS prop;
prop.data = getprop("debug.prop");
int32_t debug_mode_value[MODE1] = prop.d1;
int32_t debug_mode[MODE2] = prop.d2;
int32_t debug_mode[MODE3] = prop.d3;
int32_t debug_mode[MODE4] = prop.d4;
```
仅用一个```prop```, 就可以支持同时设置多个debug属性.

我们来看一个例子:
```C++
union BITS{
    struct {
        uint8_t d1 : 4;
        uint8_t d2 : 4;
        uint8_t d3 : 4;
        uint8_t d4 : 4;
    }u;
    uint32_t data;
};
BITS bits;
bits.data = 0x87654321;
//低16bits  0100, 0011, 0010, 0001
```
在小端存储系统中, 输出```d1-d4```是:
```
1 2 3 4
```
我们改动一下:
```C++
struct {
    uint8_t d1 : 4;
    uint8_t d2 : 2;
    uint8_t d3 : 4;
    uint8_t d4 : 4;
}u;
```
预计输出是:
```C++
//0001 //01   //1100    //0000
1      2      12        0
```
但是实际输出依然是:
```
1 2 3 4
```
原因是```d1```/```d2```已经占用6bit, 再加```d3```是10bit超过了```uint8_t```的8bit, 所以```d1```/```d2```补齐2bit按照8bit对齐.

我们可以在改动一下验证这个结论:
```C++
struct {
    uint8_t d1 : 4;
    uint8_t d2 : 2;
    uint8_t d3 : 2;
    uint8_t d4 : 4;
}u;
```
现在```d1-d4```的输出是:
```C++
//0001 //10 //00 //0011
1      2    0    3
```
符合预期```d1-d3```正好占8bit, 所以不会有补齐对齐操作.

## 位域如何实现的
通过编译器翻译后的汇编代码, 我们可以基本知道其原理:
```C++
union BITS{
    struct {
        uint8_t d1 : 4;
        uint8_t d2 : 2;
        uint8_t d3 : 2;
        uint8_t d4 : 4;
    }u;
    uint32_t data;
};

BITS bits;
bits.data = 0x87654321;

int d1 = bits.u.d1;
int d2 = bits.u.d2;
int d3 = bits.u.d3;
int d4 = bits.u.d4;
```

汇编后:

将值0x87654321赋值给```bits.data```, 这里比较好理解.
```ASM
mov     DWORD PTR [rbp-28], -2023406815
```

接下来时获取```d1```的值:
```ASM
movzx   eax, BYTE PTR [rbp-28]
and     eax, 15
movzx   eax, al
mov     DWORD PTR [rbp-4], eax
```
从首地址拿数据, 然后与0xFF(15)按位与.

再获取```d2```的数据:
```ASM
movzx   eax, BYTE PTR [rbp-28]
shr     al, 4
and     eax, 3
movzx   eax, al
mov     DWORD PTR [rbp-8], eax
```
与```d1```的区别在于, 右移4bit, 然后与0x3按位与, 这时是提取2bit.

再获取```d3```:
```ASM
movzx   eax, BYTE PTR [rbp-28]
shr     al, 6
movzx   eax, al
mov     DWORD PTR [rbp-12], eax
```
有点不同, 为什么没有按位与的操作了? 因为这里是取的BYTE, 右移6bit就可以得到高位的2bit了.

```d4```则和```d1```类似, 只不过取值地址需要+1:
```ASM
movzx   eax, BYTE PTR [rbp-27]
and     eax, 15
movzx   eax, al
mov     DWORD PTR [rbp-16], eax
```
所以, 位域操作在逻辑上和位操作是类似的, 也是通过移位和与或运算得到.

## 结论
综上, 总结struct位域:
- struct大小是最大标识符的整数倍
- union赋值struct位域需要考虑小大端
- 位域不能横跨两个标识符, 此时需要补齐对齐
- 位域也是通过移位和与或运算得到
