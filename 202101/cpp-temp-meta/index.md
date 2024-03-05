# 通过返回值'重载'函数


以下的代码片段涉及到了不少的模板函数, 可以自行去官网查询.

## 前言

从实际问题出发, 期望开发一个函数, 可以计算另外一个函数的耗时; 比如测试下面函数的耗时

<!--more-->

```C++
int funcA(int &a, float &b);
void funcB(bool &c, char &d, double &e);
```

期望可以这样调用:

```C++
(cost, ret) = costTime(funcA, a, b);
cost = costTime(funcB, c, d, e);
```

对于有返回值的函数, 不仅需要计算函数的耗时, 还需要能过获取函数的返回值; 对没有返回值的函数, 则只需要计算函数的耗时;

有多种设计思路, 一是上述的代码, 通过返回值获取时间和被测函数的返回值;

二可以通过函数参数获取时间和被测函数返回值, 但是第二种方法总有一点不适合, 因为其结构不是很美观.(一般第一个参数是func, 最后的参数是args, 那么时间或被测函数的返回值就在参数中间, 太不好看了!!!)

以下, 仅针对第一种方法, 看看怎么设计这个函数;

## 函数设计准备

编写只有一个返回值的函数来测试函数耗时比较简单, 通过可变长模板就很容易实现了, 如下

```C++
template <typename Func, typename... Args>
static double
costTimeMs(Func&& func, Args&&... args)
{
    auto get_time_us = [] () -> double {
        struct timeval time;
        gettimeofday(&time, NULL);
        double ms = time.tv_sec * 1000.0 + time.tv_usec / 1000.0;
        return ms;
    };

    double start = get_time_us();
    func(args...);
    double end = get_time_us();

    double cost = end - start;

    return cost;
}
```

但是, 还有一个需求, 就是期望也能输出函数的返回值, 并且期望函数的调用接口不要变, 怎么设计呢? 其实有点像是函数重载, 但是这里是针对**函数返回值**的重载.

C++为我们提供了enable_if这个模板函数.

### enable_if

下面摘取官方文档中的[源码](https://en.cppreference.com/w/cpp/types/enable_if)

```C++
template<bool B, class T = void>
struct enable_if {};

template<class T>
struct enable_if<true, T> { typedef T type; };
```

当使用enable_if<false>的时候, 没有任何返回; 当是用enable_if<true>的时候, 可以返回一个T类型;

刚开始看这个函数的时候不太好理解, 我们来实验一下吧. 以下改编自官方demo, 在验证的时候, 一定要**结合编译报错信息帮助理解**.

[在线编译器](https://gcc.godbolt.org/)

```C++
#include <type_traits>
#include <iostream>
#include <string>

using namespace std;

template<class T, class Enable = void>
class A {
public:
    A(){
        cout << 111 << endl;
    }
}; // primary template

template<class T>
class A<T, typename std::enable_if<std::is_void<T>::value>::type> {
public:
    A(){
        cout << 333 << endl;
    }

    template<typename TT>
    static
    typename std::enable_if<std::is_integral<TT>::value, char>::type
    func(TT a)
    {
        cout << "444" << endl;
        return 'a';
    }
    template<typename TT>
    static
    typename std::enable_if<std::is_floating_point<TT>::value, int>::type
    func(TT a)
    {
        cout << "555" << endl;
        func(0);
        cout << "666" << endl;
        return 1;
    }
    template<typename Func, typename... Args>
    static
    typename std::enable_if<std::is_void<typename std::result_of<Func(Args...)>::type>::value, float>::type
    func(Func&& f, Args&&... args)
    {
        cout << "777" << endl;
        f(args...);
        cout << "888" << endl;
        return 1.1;
    }
};

int main()
{
    A<int>{}; // OK, 用第一个A
    A<double>{}; // OK, 用第一个A
    A<void> a; // OK, 用第二个A
    cout << A<void>::func(0.0) << endl;
    cout << A<void>::func(0) << endl;

    auto f = [] (int a, int b) -> void {
        cout << a << b << endl;
    };

    cout << A<void>::func(f, 999, 999) << endl;
}
```

输出是

```
111
111
333
555
444
666
1
444
a
777
999999
888
1.1
```

说明, 给A的模板传入int和double类型的时候, 调用的都是第一个A的实现, 因为这时候没有其他匹配的模板;

给A的模板传入void类型的时候, 调用的是第二个A.
```
template<class T>
class A<T, typename std::enable_if<std::is_void<T>::value>::type> {}
```

使用A<void>::func(0.0)函数, 调用的这是第二个A里面的通过float匹配的func函数...其余可以自行配对看看调用的是哪个类和哪个函数.

接下来我们写一点bug, 让编译器报错, 看看它怎么说; 这样改写第二个A, 把与int匹配的func去掉, 编译看看
```C++
template<class T>
class A<T, typename std::enable_if<std::is_void<T>::value>::type> {
public:
    A(){
        cout << 333 << endl;
    }

    template<typename TT>
    static
    typename std::enable_if<std::is_floating_point<TT>::value, int>::type
    func(TT a)
    {
        cout << "555" << endl;
        func(0);
        cout << "666" << endl;
        return 1;
    }
    template<typename Func, typename... Args>
    static
    typename std::enable_if<std::is_void<typename std::result_of<Func(Args...)>::type>::value, float>::type
    func(Func&& f, Args&&... args)
    {
        cout << "777" << endl;
        f(args...);
        cout << "888" << endl;
        return 1.1;
    }
};
```

编译报错, 它说了什么呢? 它找遍了A里面的所有的func函数, 期望找到一个匹配的, 结果都没找到, 相当于是func没有定义, 最后抛出"error: no matching function for call to 'func'"的错误.

```
<source>:50:13: error: no matching function for call to 'func'
    cout << A<void>::func(0) << endl;
            ^~~~~~~~~~~~~
<source>:25:5: note: candidate template ignored: requirement 'std::is_floating_point<int>::value' was not satisfied [with TT = int]
    func(TT a)
    ^
<source>:35:5: note: candidate template ignored: substitution failure [with Func = int, Args = <>]: no type named 'type' in 'std::result_of<int ()>'
    func(Func&& f, Args&&... args)
    ^
<source>:28:9: error: use of undeclared identifier 'func'
        func(0);
        ^
<source>:49:22: note: in instantiation of function template specialization 'A<void, void>::func<double>' requested here
    cout << A<void>::func(0.0) << endl;
                     ^
<source>:25:5: note: must qualify identifier to find this declaration in dependent base class
    func(TT a)
    ^
<source>:35:5: note: must qualify identifier to find this declaration in dependent base class
    func(Func&& f, Args&&... args)
    ^
<source>:28:9: error: no matching function for call to 'func'
        func(0);
        ^~~~
<source>:25:5: note: candidate template ignored: requirement 'std::is_floating_point<int>::value' was not satisfied [with TT = int]
    func(TT a)
    ^
<source>:35:5: note: candidate template ignored: substitution failure [with Func = int, Args = <>]: no type named 'type' in 'std::result_of<int ()>'
    func(Func&& f, Args&&... args)
    ^
3 errors generated.
```

所以, 对enable_if, 不太准确的说就是, **enable_if是一个函数开关**, 它通过第一个模板的true/false来使能函数, 如果是false, 则函数直接被"关闭"(不使能), 如果是true, 则可以把第二个参数(类型)作为函数的返回类型(当然也可以不使用, 仅做开关也可).

## 耗时计算函数

以上, 我们使用enable_if可以来设计我们的计算耗时的函数了. 直接上代码
```C++
//当被测试函数的返回值  是void 的时候, 调用这个函数, 返回值的double类型的毫秒时间
template <typename Func, typename... Args>
static
typename std::enable_if<std::is_void<typename std::result_of<Func(Args...)>::type>::value, double>::type
costTimeMs(Func&& func, Args&&... args)
{
    auto get_time_us = [] () -> double {
        struct timeval time;
        gettimeofday(&time, NULL);
        double ms = time.tv_sec * 1000.0 + time.tv_usec / 1000.0;
        return ms;
    };

    double start = get_time_us();
    func(args...);
    double end = get_time_us();

    double cost = end - start;

    return cost;
}

//当被测试函数的返回值  非void  的时候, 调用这个函数, 返回值的tuple, 第一个值是double类型的毫秒时间, 第二个值是函数的返回值
template <typename Func, typename... Args>
static
typename std::enable_if<!(std::is_void<typename std::result_of<Func(Args...)>::type>::value),
std::tuple<double, typename std::result_of<Func(Args...)>::type>>::type
costTimeMs(Func&& func, Args&&... args)
{
    using RT = typename std::result_of<Func(Args...)>::type;
    std::tuple<double, RT> ret;
    auto nfunc = [&] () -> void {
        std::get<1>(ret) = func(args...);
    };
    std::get<0>(ret) = costTimeMs(nfunc);

    return ret;
}
```

使用typename std::result_of<Func(Args...)>::type获取函数返回值类型, 如果是void, 则调用第一个函数, 如果不是void则调用第二个函数, 第二个函数会稍微改装以下func, 使其满足返回值是void的样式.

通过返回值"重载"函数, 到此就好了.

## 原因
为什么可以这么工作呢? 其实还是比较好理解的.

模板函数编译与否, 要不要参与编译是在编译期就确定的(废话).

比如使用enable_if这个模板函数, 在编译的时候会匹配这个模板, 如果匹配上了, 那么就会返回一个类型, 正常编译; 如果没有匹配上, enable_if就什么也不返回, 函数编译不过; 比如尝试匹配后的两个函数:

```
void funcA();       //1
funcA();            //2
```

显然, 第二个是编译不过的, 但是编译器不会报错, 因为有正确匹配版本的funcA. (这里的意思是, 使用enable_if等, 需要考虑的所有情况, 不然可能会有某个调用找不到匹配的模板, 就会报错.)
