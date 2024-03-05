# Union可以怎么用


## union 改名操作

比如以下这个类，我期望外部不仅能通过P1这个名字访问P1这个成员变量，也能通过Y/R等名字访问他的P1。

<!--more-->

```cpp
template<typename T = UCHAR>
class __P3F__
{
public:
    union{
        struct{
            T P1, P2, P3;
        };
        struct{
            T Y, U, V;
        };
        struct{
            T R, G, B;
        };
        struct{
            T H, L, S;
        };
    };

public:
    __P3F__(const T &_P1, const T &_P2, const T &_P3) : P1(_P1), P2(_P2), P3(_P3) {}
    __P3F__() : P1(0), P2(0), P3(0) {}
    virtual ~__P3F__() {}

    VOID operator=(const __P3F__ &p3f)
    {
        P1 = p3f.P1;
        P2 = p3f.P2;
        P3 = p3f.P3;
    }
};
template<typename T = UCHAR>
using YUV = __P3F__<T>;
template<typename T = UCHAR>
using RGB = __P3F__<T>;
template<typename T = UCHAR>
using HLS = __P3F__<T>;
```


通过union，实现了给**成员变量重命名**，这样定义一个基础类即可。

> 这里用到了using，目的是给重命名类名，但是因为类是模板类，所以使用using，这样即使是重命名的类，也能使用模板，**如果使用typedef就需要明确模板类类型**。


## 验证内存结构

```C++
#include <iostream>

using namespace std;

typedef union
{
    struct
    {
        char low_byte;
        char mlow_byte;
        char mhigh_byte;
        char high_byte;
    } float_byte;
    float value;
} FLAOT_UNION;

int main()
{
    FLAOT_UNION f;
    f.float_byte = {0, 0, -128, 63};
    cout << f.value << endl;
    return 1;
}
```
以上, 可以验证比如float的内存结构是怎样的.

这里推荐C++在线编译器[https://gcc.godbolt.org/](https://gcc.godbolt.org/)
