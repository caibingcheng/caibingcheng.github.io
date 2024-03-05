# pair的内存结构


## 问题

在提交代码的时候发现了代码中的一个问题:

大概意思是, 有一个`pair`类型的数据, 使用如下方式打印了`pair`的`first`的数据(实际上是代码写错了, 但是依然正常工作):

<!--more-->

```C++
using ps = pair<uint64, float>;
ps p1(1, 1.1111);
printf("%p\n", p1);
```

编译是正常的, 这时候怀疑打印的结果是不是正常的呢?

## pair的实现

```C++
  template<typename _U1, typename _U2> class __pair_base
  {
#if __cplusplus >= 201103L
    template<typename _T1, typename _T2> friend struct pair;
    __pair_base() = default;
    ~__pair_base() = default;
    __pair_base(const __pair_base&) = default;
    __pair_base& operator=(const __pair_base&) = delete;
#endif // C++11
  };

  template<typename _T1, typename _T2>
    struct pair
    : private __pair_base<_T1, _T2>
    {
      typedef _T1 first_type;    /// @c first_type is the first bound type
      typedef _T2 second_type;   /// @c second_type is the second bound type

      _T1 first;                 /// @c first is a copy of the first object
      _T2 second;                /// @c second is a copy of the second object
      //................................................................
    }
```

如上, `pair`的`first`和`second`两个数据是`pair`的成员变量, `pair`没有虚函数, `pair`继承自`__pair_base`, 且`__pair_base`中没有成员变量, 到这里就可以回答上面的问题, 问题中的输出是没问题的.

以上结论可以参考[C++类的内存分布(二)](/202107/cpp-class-mem2/)和[C++类的内存分布](/202101/cpp-class-mem/).

## 验证

我们使用一小段代码验证上述结论, 源码在[这里](https://gcc.godbolt.org/z/9EaYn4vx3):
```C++
#include <iostream>
#include <vector>
using namespace std;

using uint64 = unsigned long long int;
using ps = pair<uint64, float>;

int main()
{
    ps p1(1, 1.1111);
    ps p2(2, 2.2222);
    vector<ps> vp{p1, p2};

    printf("%p\n", p1);
    printf("%p\n", p2);
    for (auto &p : vp) {
        printf("%p\n", p);
    }
}
```
可以得到期望的输出:
```C++
0x1
0x2
0x1
0x2
```
不过并不推荐这样写, 这种写法依赖对函数/结构的了解程度. 本文仅是复习之前学习的一些知识来解释一些看似不太自然的问题.

### 扩展验证

还是有些不放心, 因为`pair`是一个`struct`, 虽然我们学过`struct`基本可以等价为`class`, 但是总归没有真正看过是怎么等价的. 所以我们用下面的代码大概验证一下`class`和`struct`的内存结构是不是一样的, 下面的验证不全面, 仅初步了解, 源码在[这里](https://gcc.godbolt.org/z/1a1MMhs1T):

```C++
#include <iostream>

using namespace std;

class A{
public:
    char a;
    int b;
};
struct B{
    char a;
    int b;
};

int main() {
    A a;
    a.a = 1;
    a.b = 2;
    B b;
    b.a = 3;
    b.b = 4;

    printf("A.a = %d\n", a);
    printf("B.a = %d\n", b);

    printf("A.addr = %p\n", &a);
    printf("B.addr = %p\n", &b);

    printf("A.a.addr = %p\n", &(a.a));
    printf("B.a.addr = %p\n", &(b.a));
}
```
以上输出很奇怪:
```
A.a = 1
B.a = 174317315
A.addr = 0x7ffc0a63de28
B.addr = 0x7ffc0a63de20
A.a.addr = 0x7ffc0a63de28
B.a.addr = 0x7ffc0a63de20
```
我们本期望`B.a`输出是3, 但是我们得到了一个随机数, 所以可以观察后面的`addr`的输出, 这是符合预期的, `class`的基地址和第一个成员变量的地址一致, 那为什么`B.a`的输出不和期望呢?

考虑到是内存对齐的原因.

以上定义的成员`a`是一个`char`型, `b`是`int`型, 所以会向`b`对齐, 这时候按照`%d`解析基地址就可能有问题了, 我们改成这样的, 就能正常解析:
```C++
A a;
a.a = 65;
a.b = 2;
B b;
b.a = 66;
b.b = 4;

printf("A.a = %c\n", a);  //A.a = A
printf("B.a = %c\n", b);  //B.a = B

printf("A.addr = %p\n", &a);
printf("B.addr = %p\n", &b);

printf("A.a.addr = %p\n", &(a.a));
printf("B.a.addr = %p\n", &(b.a));
```

这小结偏题了, 但是也是在提醒我们需要注意内存对齐.

## 小结

1. `pair`的`first`成员的地址和基地址一致;
2. 要注意`class`/`struct`的内存对齐;
3. 仅量不要使用类的基地值访问类成员, 以免内存对齐/封装性等问题.
