# 现代C++容易忽略的一些特性


持续更新中...主要来源[在这里](https://changkun.de/modern-cpp/), 仅摘抄部分个人不常用或者不太理解的知识点．

<!--more-->

### 语言

#### if/switch 变量声明强化[C++17]

C++17 使得我们可以在 if（或 switch）中使用局部变量:
```C++
// 将临时变量放到 if 语句内
if (const std::vector<int>::iterator itr = std::find(vec.begin(), vec.end(), 3);
    itr != vec.end()) {
    *itr = 4;
}
```




#### 初始化列表[C++11]

C++11 首先把初始化列表的概念绑定到了类型上，并将其称之为```std::initializer_list```，允许构造函数或其他函数像参数一样使用初始化列表，这就为类对象的初始化与普通数组和 POD 的初始化方法提供了统一的桥梁，例如：
```C++
#include <initializer_list>
#include <vector>
class MagicFoo {
public:
    std::vector<int> vec;
    MagicFoo(std::initializer_list<int> list) {
        for (std::initializer_list<int>::iterator it = list.begin();
             it != list.end(); ++it)
            vec.push_back(*it);
    }
};
int main() {
    // after C++11
    MagicFoo magicFoo = {1, 2, 3, 4, 5};

    std::cout << "magicFoo: ";
    for (std::vector<int>::iterator it = magicFoo.vec.begin(); it != magicFoo.vec.end(); ++it) std::cout << *it << std::endl;
}
```
初始化列表除了用在对象构造上，还能将其作为普通函数的形参，例如：
```C++
public:
    void foo(std::initializer_list<int> list) {
            for (std::initializer_list<int>::iterator it = list.begin(); it != list.end(); ++it) vec.push_back(*it);
    }

magicFoo.foo({6,7,8,9});
```
其次，C++11 还提供了统一的语法来初始化任意的对象，例如：
```C++
Foo foo2 {3, 4};
```

```std::initializer_list```和```std::vector```区别: ```std::initializer_list```一般是在栈上的, 不可修改, ```std::vector```在堆上, [详细](https://www.jianshu.com/p/3d69ff89a0c9)



#### 结构化绑定[C++17]

```C++
#include <iostream>
#include <tuple>

std::tuple<int, double, std::string> f() {
    return std::make_tuple(1, 2.3, "456");
}

int main() {
    auto [x, y, z] = f();
    std::cout << x << ", " << y << ", " << z << std::endl;
    return 0;
}
```



#### 返回值推导[C++14]

**不用后缀decltype了**.  C++14 开始是可以直接让普通函数具备返回值推导:

```C++
template<typename T, typename U>
auto add3(T x, U y){
    return x + y;
}
```



#### 外部模板[C++11]

在没有外部模板时可能会产生多个相同的实例, 带来冗余. 外部模板允许只有一个实例化了.

```C++
template class std::vector<bool>;          // 强行实例化
extern template class std::vector<double>; // 不在该当前编译文件中实例化模板
```



#### 类型别名模板[C++11]

使用```using```完全代替```typedef```.

```C++
typedef int (*process)(void *);
using NewProcess = int(*)(void *);
template<typename T>
using TrueDarkMagic = MagicType<std::vector<T>, std::string>;

int main() {
    TrueDarkMagic<bool> you;
}
```



#### 折叠表达式[C++17]

```C++
#include <iostream>
template<typename ... T>
auto sum(T ... t) {
    return (t + ...);
}
int main() {
    std::cout << sum(1, 2, 3, 4, 5, 6, 7, 8, 9, 10) << std::endl;
}
```



#### 非类型模板推导auto[C++17]

```C++
template <auto value> void foo() {
    std::cout << value << std::endl;
    return;
}

int main() {
    foo<10>();  // value 被推导为 int 类型
}
```



#### 委托构造[C++11]

```C++
#include <iostream>
class Base {
public:
    int value1;
    int value2;
    Base() {
        value1 = 1;
    }
    Base(int value) : Base() { // 委托 Base() 构造函数
        value2 = value;
    }
};

int main() {
    Base b(2);
    std::cout << b.value1 << std::endl;
    std::cout << b.value2 << std::endl;
}
```



#### 继承构造[C++11]

```C++
#include <iostream>
class Base {
public:
    int value1;
    int value2;
    Base() {
        value1 = 1;
    }
    Base(int value) : Base() { // 委托 Base() 构造函数
        value2 = value;
    }
};
class Subclass : public Base {
public:
    using Base::Base; // 继承构造
};
int main() {
    Subclass s(3);
    std::cout << s.value1 << std::endl;
    std::cout << s.value2 << std::endl;
}
```



#### 右值引用[C++11]

TODO



#### 字面量[C++11]

C++11 提供了原始字符串字面量的写法, 可以在一个字符串前方使用 `R` 来修饰这个字符串, 同时, 将原始字符串使用括号包裹, 例如:

```C++
#include <iostream>
#include <string>

int main() {
    std::string str = R"(C:\File\To\Path)"; //不需要转义了
    std::cout << str << std::endl;
    return 0;
}
```



#### 自定义字面量[C++11]

C++11 引进了自定义字面量的能力, 通过重载双引号后缀运算符实现:

```C++
// 字符串字面量自定义必须设置如下的参数列表
std::string operator"" _wow1(const char *wow1, size_t len) {
    return std::string(wow1)+"woooooooooow, amazing";
}

std::string operator"" _wow2 (unsigned long long i) {
    return std::to_string(i)+"woooooooooow, amazing";
}

int main() {
    auto str = "abc"_wow1;
    auto num = 1_wow2;
    std::cout << str << std::endl;
    std::cout << num << std::endl;
    return 0;
}
```

自定义字面量支持四种字面量：

1. 整型字面量: 重载时必须使用 `unsigned long long`/`const char *`模板字面量算符参数, 在上面的代码中使用的是前者;
2. 浮点型字面量: 重载时必须使用 `long double`/`const char *`/模板字面量算符;
3. 字符串字面量: 必须使用 `(const char *, size_t)` 形式的参数表;
4. 字符字面量: 参数只能是 `char`, `wchar_t`, `char16_t`, `char32_t` 这几种类型.



#### 内存对齐[C++11]

TODO



### 容器

#### std::array[C++11]

注意和```std::vector```的区别. 如果是已知并且固定大小的数组, 可以考虑使用```std::array```.

1. 与 `std::vector` 不同，`std::array` 对象的大小是固定的;
2. ```std::vector```执行```clear()```方法后, 需要使用释放内存, ```std::array```则自动释放内存;
3. 提供```data()```方法, 从而可以兼容C风格指针访问.



#### std::forward_list[C++11]

类似```std::list```, 但是```std::forward_list```指单向列表, 不提供size()方法.



#### 运行时获取std::tuple元素[C++17]

```std::get<>()```方法只可以在编译期获取元素, 使用```std::variant<>```可以在运行时获取元素:

```C++
#include <variant>
template <size_t n, typename... T>
constexpr std::variant<T...> _tuple_index(const std::tuple<T...>& tpl, size_t i) {
    if constexpr (n >= sizeof...(T))
        throw std::out_of_range("越界.");
    if (i == n)
        return std::variant<T...>{ std::in_place_index<n>, std::get<n>(tpl) };
    return _tuple_index<(n < sizeof...(T)-1 ? n+1 : 0)>(tpl, i);
}
template <typename... T>
constexpr std::variant<T...> tuple_index(const std::tuple<T...>& tpl, size_t i) {
    return _tuple_index<0>(tpl, i);
}
template <typename T0, typename ... Ts>
std::ostream & operator<< (std::ostream & s, std::variant<T0, Ts...> const & v) {
    std::visit([&](auto && x){ s << x;}, v);
    return s;
}
```



### 并行与并发

#### C++11内存顺序模型[C++11]

TODO




