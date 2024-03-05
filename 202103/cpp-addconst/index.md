# 为什么推荐加const或constexpr修饰常量


> 用[const/constexpr](/202103/cpp-const-adconsexpr/)修饰常量可以减少内存占用和拷贝操作.

这是我们在很多书上可以看到的结论, 但是为什么用[const/constexpr](/202103/cpp-const-adconsexpr/)修饰常量可以减少内存占用和拷贝操作呢?


<!--more-->

## 测试

### 不使用const/constexpr修饰

我们先来看一个反例, 不使用[const/constexpr](/202103/cpp-const-adconsexpr/)修饰常量:
```C++
using namespace std;

int num = 10;

int main()
{
    int get_num = num;
    return 1;
}
```

我们可以得到汇编代码:
```ASM
mov    eax,DWORD PTR [rip+0x2f1c]        # 404028 <num>
mov    DWORD PTR [rbp-0x4],eax
```

上面的汇编代码是```int get_num = num;```这一句, ```num```被放在内存中, 先给寄存器```eax```, ```eax```再将值赋给```get_num```.

在这里, 我们**消耗了sizeof(int)的内存空间, 多了一个赋值操作**.

### 使用const/constexpr修饰

```C++
using namespace std;

const int num = 10;

int main()
{
    int get_num = num;
    return 1;
}
```

```int get_num = num;```汇编后:
```ASM
mov    DWORD PTR [rbp-0x4],0xa
```

将```num```的值直接赋值给```get_num```, **没有额外的内存占用, 没有额外的赋值操作**.

但是, **使用[const/constexpr](/202103/cpp-const-adconsexpr/)修饰会让常量暴露出来**(反汇编程序之后, 我们可以直接知道常量值是多少), 安全性较低.
