# 对C++bind的理解


bind的设计思想: 高内聚, 低耦合, **使被调用的函数和调用者完全隔离开来**. 调用者可以根据需要任意设计接口和传参, 而被调用函数通过bind可以不经修改接口就可以兼容各种需求的变化.

<!--more-->

在博客上查到我认为比较精髓的理解是, **使被调用的函数和调用者完全隔离开来**

## 例子

- bind默认参数是拷贝，而不是引用，摘自cnblog的一段代码

```cpp
#include <functional>
#include <iostream>

void f(int& n1, int& n2, const int& n3)
{
    std::cout << "In function: " << n1 << ' ' << n2 << ' ' << n3 << '\n';
    ++n1; // increments the copy of n1 stored in the function object
    ++n2; // increments the main()'s n2
    // ++n3; // compile error
}

int main()
{
    int n1 = 1, n2 = 2, n3 = 3;
    std::function<void()> bound_f = std::bind(f, n1, std::ref(n2),    std::cref(n3));
    n1 = 10;
    n2 = 11;
    n3 = 12;
    std::cout << "Before function: " << n1 << ' ' << n2 << ' ' << n3 << '\n';
    bound_f();
    std::cout << "After function: " << n1 << ' ' << n2 << ' ' << n3 << '\n';
}
```

如上输出是以下， 意味着， bind绑定参数时使用的是值拷贝（在绑定的时候就已经拷贝值了， 后续再改变这个变量也无济于事），而不是引用，使用std::ref可以把这种绑定指定为引用的。std::cref则是const referrence

```cpp
Before function: 10 11 12
In function: 1 11 12
After function: 10 12 12
```

- 占位符可以不是顺序的，可以改变参数顺序和个数

如下，_2和_1没有按顺序，最终返回的函数f1也算是打乱了函数f的顺序的。

```cpp
auto f1 = std::bind(f, _2, 42, _1, std::cref(n), n);
n = 10;
f1(1, 2, 1001); // 1 is bound by _1, 2 is bound by _2, 1001 is unused
                    // makes a call to f(2, 42, 1, n, 7)
```

- 绑定函数中再绑定函数

如下，绑定函数f的同时，再绑定了函数g作为参数，并且都共享占位符_3。这里也可以看到函数f2有两个参数_1,_2是直接认为无效的。

```cpp
// nested bind subexpressions share the placeholders
auto f2 = std::bind(f, _3, std::bind(g, _3), _3, 4, 5);
f2(10, 11, 12); // makes a call to f(12, g(12), 12, 4, 5);
```

- 绑定普通成员函数

**要注意把类实例也绑定上去**，不然是找不到这个函数地址的！

```
 Foo foo;
 auto f3 = std::bind(&Foo::print_sum, &foo, 95, _1);
 f3(5);
```

- mem_fn和bind类似，我认为算是bind子集，但是对入参有扩展，mem_fn绑定成员函数(成员函数绑定)后的可调用函数的第一个参数，是类实例，可以实现无限多成员参数。而bind只能实现10个参数的绑定。

```cpp
#include <functional>
#include <iostream>

struct Foo {
    void display_greeting() {
        std::cout << "Hello, world.\n";
    }
    void display_number(int i) {
        std::cout << "number: " << i << '\n';
    }
    int data = 7;
};

int main() {
    Foo f;

    auto greet = std::mem_fn(&Foo::display_greeting);
    greet(f);

    auto print_num = std::mem_fn(&Foo::display_number);
    print_num(f, 42);

    auto access_data = std::mem_fn(&Foo::data);
    std::cout << "data: " << access_data(f) << '\n';
}
```

输出是，

```cpp
Hello, world.
number: 42
data: 7
```

