# STL-智能指针三剑客源码阅读


智能指针出现很多, 但是自己用得很少. 本文从源码层面来学习智能指针, 学习是怎么实现的, 以及如此实现可以实现如何的功能.

<!--more-->

## unique_ptr

我认为`unique_ptr`是编译器强制人类某些行为的例子, 只允许人类这样做而不允许人类那样做. 可以参考[explicit说明符](/202112/cpp-explicit/)的一些想法.

源码在[这里](https://code.woboq.org/gcc/libstdc++-v3/include/bits/unique_ptr.h.html#std::unique_ptr).

其析构函数会释放内存资源:
```C++
~unique_ptr() noexcept
{
    auto& __ptr = _M_t._M_ptr();
    if (__ptr != nullptr)
        get_deleter()(__ptr);
    __ptr = pointer();
}
```

为了保证这一点, `unique_ptr`就不允许用户将一块内容"多人"使用, 所以需要限制用户的拷贝和赋值行为:
```C++
// Disable copy from lvalue.
unique_ptr(const unique_ptr&) = delete;
unique_ptr& operator=(const unique_ptr&) = delete;
```

禁用了左值拷贝构造和赋值, 这样可以保证只有一个`unique_ptr`指向一块内存, 不会有多个`unique_ptr`指向一块内存. 但是允许了右值拷贝构造和赋值:

```C++
unique_ptr(unique_ptr&& __u) noexcept
: _M_t(__u.release(), std::forward<deleter_type>(__u.get_deleter())) { }

unique_ptr&
operator=(unique_ptr&& __u) noexcept
{
    reset(__u.release());
    get_deleter() = std::forward<deleter_type>(__u.get_deleter());
    return *this;
}
```

右值在构造结束后就会被销毁, 所以此处的右值构造可以保证只有一个`unique_ptr`指向一块内存. 在内存转移的时候使用的是`release`接口(和`reset(__u._M_t)`是有区别的), 因为内存转移时候需要保证原`unique_ptr`的数据指针为空, 不能指向需要转移的内存, 不然在临时变量析构的时候会释放这块内存. 所以`release`接口的作用就是提取数据内存的指针, 将本来数据指针置空, 返回数据内存指针:

```C++
pointer
release() noexcept
{
    pointer __p = get();
    _M_t._M_ptr() = pointer();
    return __p;
}
```

`unique_ptr`有太多行为限制, 除了行为限制, 比较容易想到的是使用计数器形式实现RAII.

## shared_ptr

`shared_ptr`是基于计数器的智能指针, 继承自`__shared_ptr`, 自身没有实现任何引用计数的功能. [`shared_ptr`源码](https://code.woboq.org/gcc/libstdc++-v3/include/bits/shared_ptr.h.html)
```C++
template<typename _Tp>
    class shared_ptr : public __shared_ptr<_Tp>
```

`__shared_ptr` 继承自 `__shared_ptr_access`.
```C++
template<typename _Tp, _Lock_policy _Lp>
    class __shared_ptr
    : public __shared_ptr_access<_Tp, _Lp>
```

`__shared_ptr`本身维护两个变量, 内容指针和引用计数器.
```C++
element_type*           _M_ptr;         // Contained pointer.
__shared_count<_Lp>     _M_refcount;    // Reference counter.
```

### 计数器的使用

以下看看`__shared_ptr`实现了哪些需要借助引用计数的方法:

1. 拷贝构造

拷贝构造数据和计数器, 而计数器的拷贝构造会使得计数器的值+1.
```C++
__shared_ptr(const __shared_ptr&) noexcept = default;
```

右值构造, 相当于右值的数据和计数器给了左值, 右值获得了空的数据和0计数器. 因为右值本身就只有一个引用, 所以交换是可以的.
```C++
__shared_ptr(__shared_ptr&& __r) noexcept
: _M_ptr(__r._M_ptr), _M_refcount()
{
_M_refcount._M_swap(__r._M_refcount);
__r._M_ptr = 0;
}
```

2. 复制操作

左值复制使用默认函数, 所以涉及到计数器的复制, 计数器复制操作也会设计+1操作.
```C++
__shared_ptr& operator=(const __shared_ptr&) noexcept = default;
```

右值复制同右值构造, 使用`swap`交换.
```C++
__shared_ptr&
operator=(__shared_ptr&& __r) noexcept
{
    __shared_ptr(std::move(__r)).swap(*this);
    return *this;
}
```

以上, 可以知道`shared_ptr`在左值构造和左值复制操作时会涉及计数器+1的操作.

### 计数器的实现

重点关注引用计数器的实现:
```C++
template<_Lock_policy _Lp>
class __shared_count
{
public:
    constexpr __shared_count() noexcept : _M_pi(0)
    { }

    __shared_count(const __shared_count& __r) noexcept
    : _M_pi(__r._M_pi)
    {
        if (_M_pi != 0)
            _M_pi->_M_add_ref_copy();
    }

    __shared_count&
    operator=(const __shared_count& __r) noexcept
    {
        _Sp_counted_base<_Lp>* __tmp = __r._M_pi;
        if (__tmp != _M_pi)
        {
            if (__tmp != 0)
                __tmp->_M_add_ref_copy();
            if (_M_pi != 0)
                _M_pi->_M_release();
                _M_pi = __tmp;
        }
        return *this;
    }

    void
    _M_swap(__shared_count& __r) noexcept
    {
        _Sp_counted_base<_Lp>* __tmp = __r._M_pi;
        __r._M_pi = _M_pi;
        _M_pi = __tmp;
    }


//...
private:
    friend class __weak_count<_Lp>;
    _Sp_counted_base<_Lp>*  _M_pi;
}
```
引用计数器的拷贝构造和复制操作都涉及到了计数器的加减, 拷贝构造时计数器会默认+1, 而复制操作时可能会将=右边的计数器释放.

这里有个疑问, 为什么拷贝构造和复制操作的行为不一样呢?

因为拷贝构造时说明原本还没有构造计数器, 对应的就是`shared_ptr`的拷贝构造, 比如`shared_ptr<int> p2(p1)`, 这时候`p1`和`p2`都没有被释放, 是能够正常使用的, 所以拷贝构造时只需要计数器+1就行了. 复制操作需要释放是因为原本指向一个数据的指针会指向另外一个数据, 比如`p2 = p1`, `p2`原本可能指向`p`, 这时候变成了指向`p1`, 所以原来`p`的计数器需要-1, `p1`的计数器就需要+1.

以上计数器操作来自于`_Sp_counted_base`, 那么`_Sp_counted_base`是怎么实现的? [源码](https://code.woboq.org/gcc/libstdc++-v3/include/bits/shared_ptr_base.h.html#std::_Sp_counted_base::_M_use_count)
```C++
template<_Lock_policy _Lp = __default_lock_policy>
class _Sp_counted_base
: public _Mutex_base<_Lp>
{
    public:
        _Sp_counted_base() noexcept
        virtual
        ~_Sp_counted_base() noexcept
        { }

        : _M_use_count(1), _M_weak_count(1) { }

        void
        _M_add_ref_copy()
        { __gnu_cxx::__atomic_add_dispatch(&_M_use_count, 1); }
        //...

    private:
        _Sp_counted_base(_Sp_counted_base const&) = delete;
        _Sp_counted_base& operator=(_Sp_counted_base const&) = delete;
        _Atomic_word  _M_use_count;     // #shared
        _Atomic_word  _M_weak_count;    // #weak + (#shared != 0)
};
```
`_Sp_counted_base`维护了两个计数器, 一个用于`shared`一个用于`weak`, 并且两个都是原子变量, 如果关注源码, 还可以发现`add`或者`release`操作也是原子的, 并且`release`操作时会涉及内存屏障(TODO:内存屏障还不太了解).

同时,`_Sp_counted_base`的析构函数什么都没有做, 所以如果需要析构release计数器, 就依赖于上层函数的接口, 对应的就是:
```C++
__shared_count::~__shared_count() noexcept
{
if (_M_pi != nullptr)
    _M_pi->_M_release();
}
```

### 什么时候删除

一般猜测是析构函数的时候会`delete`数据, 但是并没有很容易地找到对应的代码, 所以这部分会介绍数据的`delete`到底是在哪里.

`__shared_ptr`的构造函数令人怀疑, 因为`_M_refcount`会需求一个`__p`参数来构造, 而`__p`代表了源数据.
```C++
template<typename _Yp, typename _Deleter, typename = _SafeConv<_Yp>>
__shared_ptr(_Yp* __p, _Deleter __d)
: _M_ptr(__p), _M_refcount(__p, std::move(__d))
{
    static_assert(__is_invocable<_Deleter&, _Yp*&>::value,
        "deleter expression d(p) is well-formed");
    _M_enable_shared_from_this_with(__p);
}
```

接下来看看`__shared_count`的构造函数, 一般会调用下面这个构造函数, 不一般的情况就不分析了...
```C++
template<typename _Ptr, typename _Deleter, typename _Alloc>
__shared_count(_Ptr __p, _Deleter __d, _Alloc __a) : _M_pi(0)
{
    typedef _Sp_counted_deleter<_Ptr, _Deleter, _Alloc, _Lp> _Sp_cd_type;
    __try
    {
        typename _Sp_cd_type::__allocator_type __a2(__a);
        auto __guard = std::__allocate_guarded(__a2);
        _Sp_cd_type* __mem = __guard.get();
        ::new (__mem) _Sp_cd_type(__p, std::move(__d), std::move(__a));
        _M_pi = __mem;
        __guard = nullptr;
    }
    __catch(...)
    {
        __d(__p); // Call _Deleter on __p.
        __throw_exception_again;
    }
}
```

这部分构造函数中包含了数据指针:
```C++
::new (__mem) _Sp_cd_type(__p, std::move(__d), std::move(__a));
```
`_Sp_cd_type`对应的`_Sp_counted_deleter`比较令我注意, 它继承自`_Sp_counted_base`, 并且会将`_Sp_counted_deleter`类型的数据赋值给`_M_pi`.

`_Sp_counted_deleter`的定义如下:
```C++
// Support for custom deleter and/or allocator
template<typename _Ptr, typename _Deleter, typename _Alloc, _Lock_policy _Lp>
class _Sp_counted_deleter final : public _Sp_counted_base<_Lp>
```
注意到, `_M_pi`对应的是如下:
```C++
_Sp_counted_base<_Lp>*  _M_pi;
```
在此之前我们分析了`_Sp_counted_base`的析构函数什么也没有做, 依赖于`__shared_count`的析构, 而`__shared_count`的析构会调用`_M_release`.
```C++
void
_M_release() noexcept
{
    // Be race-detector-friendly.  For more info see bits/c++config.
    _GLIBCXX_SYNCHRONIZATION_HAPPENS_BEFORE(&_M_use_count);
    if (__gnu_cxx::__exchange_and_add_dispatch(&_M_use_count, -1) == 1)
    {
    _GLIBCXX_SYNCHRONIZATION_HAPPENS_AFTER(&_M_use_count);
    _M_dispose();
    // There must be a memory barrier between dispose() and destroy()
    // to ensure that the effects of dispose() are observed in the
    // thread that runs destroy().
    // See http://gcc.gnu.org/ml/libstdc++/2005-11/msg00136.html
    if (_Mutex_base<_Lp>::_S_need_barriers)
        {
        __atomic_thread_fence (__ATOMIC_ACQ_REL);
        }
    // Be race-detector-friendly.  For more info see bits/c++config.
    _GLIBCXX_SYNCHRONIZATION_HAPPENS_BEFORE(&_M_weak_count);
    if (__gnu_cxx::__exchange_and_add_dispatch(&_M_weak_count,
                                                -1) == 1)
        {
        _GLIBCXX_SYNCHRONIZATION_HAPPENS_AFTER(&_M_weak_count);
        _M_destroy();
        }
    }
}
```
我们只看`shared`引用部分, 计数器减少到0后会调用到`_M_dispose`, 这是一个虚函数, 所以会调用到子类的`_M_dispose`. 对应的则是`_Sp_counted_deleter`的`_M_dispose`. 其内容为:
```C++
virtual void
_M_dispose() noexcept
{ _M_impl._M_del()(_M_impl._M_ptr); }
```
原来是在这里`delete`源数据的! 比较令我困惑的是, 删除数据的操作是在计数器对象里面的进行的.


### 循环引用

这是`shared_ptr`中谈论比较多的问题, 比如:
```C++
#include <iostream>
#include <memory>

using namespace std;

class Father;
class Son;

class Father{
public:
    shared_ptr<Son> m_son;

    Father() {
        cout << __func__ << endl;
    };
    ~Father() {
        cout << __func__ << endl;
    };
};

class Son{
public:
    shared_ptr<Father> m_father;

    Son() {
        cout << __func__ << endl;
    };
    ~Son() {
        cout << __func__ << endl;
    };
};

int main(){
    shared_ptr<Father> father(new Father);
    shared_ptr<Son> son(new Son);

    father->m_son = son;
    son->m_father = father;

    cout << "father count " << father.use_count() << endl;
    cout << "son count " << son.use_count() << endl;
}
```
输出是:
```
Father
Son
father count 2
son count 2
```
只有构造没有析构, 因为在函数退出时引用计数器时2, 这时候就需要我们手动`release`一遍, 但是这明显不符合`RAII`的原则, 会导致`shared_ptr`四不象. 为应对这个问题, 设计了`weak_ptr`类.

## weak_ptr

同`shared_ptr`, `weak_ptr`的主要实现在`__weak_ptr`:
```C++
template<typename _Tp, _Lock_policy _Lp>
class __weak_ptr
```

没有发现`__weak_ptr`有任何基类. 关注`__weak_ptr`的构造可以发现, 是没有普通指针的构造接口的, 但是可以从`weak_ptr`或者`shared_ptr`构造.

这里关注两个常用的方法:
```C++
__shared_ptr<_Tp, _Lp>
lock() const noexcept
{ return __shared_ptr<element_type, _Lp>(*this, std::nothrow); }
```
`lock`方法会将`weak`指针转换为`shared`指针, 从而可以访问数据内存, 并且`weak`指针是不提供方法直接访问数据内存的.

```C++
long
use_count() const noexcept
{ return _M_refcount._M_get_use_count(); }
```
`use_count`方法返回数据内存的引用计数, `_M_get_use_count`实际返回的是`shared`计数, 而不是`weak`计数.

再来关注`class __weak_count`, 类似的, 在构造的时候会增加计数器:
```C++
__weak_count(const __shared_count<_Lp>& __r) noexcept
: _M_pi(__r._M_pi)
{
    if (_M_pi != nullptr)
        _M_pi->_M_weak_add_ref();
}
```

析构的时候会减少计数器:
```C++
~__weak_count() noexcept
{
    if (_M_pi != nullptr)
        _M_pi->_M_weak_release();
}
```

但是, 区别于`shared`指针的计数器, `weak`指针使用的是`weak`计数器, 目前来看`weak`计数器似乎没有用到, 仅在`weak`计数器为0的时候会释放`weak_count`自身.

以上, `weak_ptr`不会增加`shared`计数器, 会增加`weak`计数器, 不能直接访问`weak_ptr`指向的数据, 需要转换为`share_ptr`才能访问.

`weak_ptr`的构造决定了它一般是和`shared_ptr`配合使用的, 更像是担任数据缓存的角色(或者说数据快照), 它自身不维护数据的生命周期, 如果源数据被释放无法访问了, 那`weak_ptr`也将无法访问源数据, 比如`shared_ptr`循环引用问题, 可以这样改写:

```C++
#include <iostream>
#include <memory>

using namespace std;

class Father;
class Son;

class Father{
public:
    weak_ptr<Son> m_son;

    Father() {
        cout << __func__ << endl;
    };
    ~Father() {
        cout << __func__ << endl;
    };
};

class Son{
public:
    weak_ptr<Father> m_father;

    Son() {
        cout << __func__ << endl;
    };
    ~Son() {
        cout << __func__ << endl;
    };
};

int main(){
    shared_ptr<Father> father(new Father);
    shared_ptr<Son> son(new Son);

    father->m_son = son;
    son->m_father = father;

    cout << "father count " << father.use_count() << endl;
    cout << "son count " << son.use_count() << endl;
}
```

输出是:
```
Father
Son
father count 1
son count 1
~Son
~Father
```

## 总结

1. `unique_ptr`通过限制用户行为实现了内存的RAII;
2. `shared_ptr`通过引用计数实现了内存的RAII, 但是存在循环引用问题;
3. `shared_ptr`通过扩展`weak_ptr`解决了循环引用的问题, 将`weak_ptr`当做是内存的缓存/快照.

还能总结一些方法:

1. 设计一个工具类的时候, 不仅仅可以考虑其方法函数, 也可以在构造函数上做文章;
2. 资源可以有访问接口和管理接口, 类比`shared_ptr`的资源, 资源会给`_M_ptr`用于访问, 也会给`_M_refcount`用于管理, 是分开的;

