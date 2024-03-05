# C++容器操作


## 问题

容器存指针，调用erase、clear是否会调用元素的析构函数？

<!--more-->

  - 不会调用析构函数

容器存类（非指针），是否会调用构造拷贝函数？使用erase、clear是否会调用析构函数？
  - 会调用拷贝构造函数
  - 会调用析构函数


## 容器存指针

```cpp
#include <iostream>
#include <list>
#include <vector>

using namespace std;

class ELE
{
public:
    ELE() : m_id(-1){
        print("create ++++A ");
    }
    ELE(const int &id) : m_id(id){
        print("create ++++B ");
    }
    ELE(const ELE &ele){
        m_id = ele.id();
        print("copy   ====A ", ele);
    }
    void operator=(const ELE& ele) {
        m_id = ele.id();
        print("copy   ====B ", ele);
    }
    ~ELE(){
        print("delete ----A ");
    }

    int id() const { return m_id; }
    void print() {
        cout << "print        " << this << "(" << m_id << ")" << endl;
    }

private:
    void print(const char* head){
        cout << head << this << "(" << m_id << ")" << endl;
    }
    void print(const char* head, const ELE &ele){
        cout << head << &ele << "(" << ele.id() << ")" << " --> " << this << "(" << m_id << ")" << endl;
    }
    int m_id;
};

int main()
{
    vector<ELE *> eleList;
    eleList.reserve(5);
    ELE *ele;

    cout << "************start push************" << endl;
    for (int i = 0; i < 3; i++)
    {
        ele = new ELE(i);
        eleList.emplace_back(ele);
    }
    cout << "************end push************" << endl << endl;

    cout << "************start process************" << endl;
    for (auto ele : eleList)
    {
        ele->print();
    }
    cout << "************end process************" << endl << endl;

    cout << "************start erase************" << endl;
    for (auto it = eleList.begin(); it != eleList.end(); it)
    {
        eleList.erase(it);
    }
    // eleList.clear();
    cout << "************end erase************" << endl << endl;

    return 1;
}

```

需要注意erase那一段代码，**erase之后迭代器已经指向了下一个元素**，所以不能再it++，可以实验以下，我这里测试的结果是会陷入死循环，打印不出“end erase”。

以上输出，

```cpp
************start push************
create ++++B 0xfefeb0(0)
create ++++B 0xfefed0(1)
create ++++B 0xfefef0(2)
************end push************

************start process************
print        0xfefeb0(0)
print        0xfefed0(1)
print        0xfefef0(2)
************end process************

************start erase************
************end erase************

```

push操作没有多余的拷贝（会拷贝指针的值），process部分也没有多余的拷贝（会拷贝指针的值），但是erase部分，没有任何输出！这里内存泄漏了。

以上，可以有以下结论：

- erase操作不会调用指针的析构函数；
- push操作不会调用指针的拷贝构造函数；

所以容器指针还需要额外调用delete删除。

```cpp
for (auto ele : eleList)
{
    delete ele;
}
```

## 容器存非指针

```cpp
#include <iostream>
#include <list>
#include <vector>

using namespace std;

class ELE
{
public:
    ELE() : m_id(-1){
        print("create ++++A ");
    }
    ELE(const int &id) : m_id(id){
        print("create ++++B ");
    }
    ELE(const ELE &ele){
        m_id = ele.id();
        print("copy   ====A ", ele);
    }
    void operator=(const ELE& ele) {
        m_id = ele.id();
        print("copy   ====B ", ele);
    }
    ~ELE(){
        print("delete ----A ");
    }

    int id() const { return m_id; }
    void print() {
        cout << "print        " << this << "(" << m_id << ")" << endl;
    }

private:
    void print(const char* head){
        cout << head << this << "(" << m_id << ")" << endl;
    }
    void print(const char* head, const ELE &ele){
        cout << head << &ele << "(" << ele.id() << ")" << " --> " << this << "(" << m_id << ")" << endl;
    }
    int m_id;
};

int main()
{
    vector<ELE> eleList;
    eleList.reserve(5);
    ELE ele;

    cout << "************start push************" << endl;
    for (int i = 0; i < 3; i++)
    {
        ele = ELE(i);
        eleList.emplace_back(ele);
    }
    cout << "************end push************" << endl << endl;

    cout << "************start process************" << endl;
    for (auto ele : eleList)
    {
        ele.print();
    }
    cout << "************end process************" << endl << endl;

    cout << "************start erase************" << endl;
    eleList.clear();
    cout << "************end erase************" << endl << endl;

    return 1;
}
```

输出：

```cpp
create ++++A 0x7ffd82be4afc(-1)

************start push************
create ++++B 0x7ffd82be4b24(0)
copy   ====B 0x7ffd82be4b24(0) --> 0x7ffd82be4afc(0)
delete ----A 0x7ffd82be4b24(0)
copy   ====A 0x7ffd82be4afc(0) --> 0x112ee70(0)
create ++++B 0x7ffd82be4b24(1)
copy   ====B 0x7ffd82be4b24(1) --> 0x7ffd82be4afc(1)
delete ----A 0x7ffd82be4b24(1)
copy   ====A 0x7ffd82be4afc(1) --> 0x112ee74(1)
create ++++B 0x7ffd82be4b24(2)
copy   ====B 0x7ffd82be4b24(2) --> 0x7ffd82be4afc(2)
delete ----A 0x7ffd82be4b24(2)
copy   ====A 0x7ffd82be4afc(2) --> 0x112ee78(2)
************end push************

************start process************
copy   ====A 0x112ee70(0) --> 0x7ffd82be4af4(0)
print        0x7ffd82be4af4(0)
delete ----A 0x7ffd82be4af4(0)
copy   ====A 0x112ee74(1) --> 0x7ffd82be4af4(1)
print        0x7ffd82be4af4(1)
delete ----A 0x7ffd82be4af4(1)
copy   ====A 0x112ee78(2) --> 0x7ffd82be4af4(2)
print        0x7ffd82be4af4(2)
delete ----A 0x7ffd82be4af4(2)
************end process************

************start erase************
delete ----A 0x112ee70(0)
delete ----A 0x112ee74(1)
delete ----A 0x112ee78(2)
************end erase************

delete ----A 0x7ffd82be4afc(2)
```

以上，有几点结论：

- 类直接push到容器，会调用拷贝构造函数；（两个地址不一样了）
- clear方法会调用容器元素的析构函数；
- 直接push和调用普通类会多一些copy操作（重构=）；

如果去掉reserve方法，还会有点问题：

- 容器长度是动态增长的，所以不加reserve会有更多的copy操作；

用erase替换clear操作

```cpp
for (auto it = eleList.begin(); it != eleList.end(); it)
{
    eleList.erase(it);
}
```

得到输出

```cpp
************start erase************
copy   ====B 0x1c0ae74(1) --> 0x1c0ae70(1)
copy   ====B 0x1c0ae78(2) --> 0x1c0ae74(2)
delete ----A 0x1c0ae78(2)
copy   ====B 0x1c0ae74(2) --> 0x1c0ae70(2)
delete ----A 0x1c0ae74(2)
delete ----A 0x1c0ae70(2)
************end erase************
```

可以看到，相比clear多了很多copy操作。看起来是erase不仅调用析构函数，同时也会清除容器空间。

- erase会调用析构函数；
- erase会删除容器空间；

## 结论

- erase之后迭代器已经指向了下一个元素，不需要it++；
- erase操作不会调用指针的析构函数；
- push操作不会调用指针的拷贝构造函数；
- 类直接push到容器，会调用拷贝构造函数；（两个地址不一样了）
- clear方法会调用容器元素的析构函数；
- 直接push和调用普通类会多一些copy操作（重构=）；
- 容器长度是动态增长的，所以不加reserve会有更多的copy操作；
- erase会调用析构函数；
- erase会删除容器空间；

所以，我认为：

- 容器使用前尽量reserve
- 容器尽量存类的指针；
- 容器如果存的指针要记得显示地调用delete；

