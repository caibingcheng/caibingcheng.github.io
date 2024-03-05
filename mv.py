import os
import shutil

src = "./posts"
dst = "./posts"

dirs = os.listdir(src)
# print(dirs)

for dir in dirs:
    target_dir = src + '/' + dir + '/'
    target_name = dir + '.md'
    if os.path.isdir(target_dir):
        rfile = target_dir + 'index.md'
        target_name = target_dir + target_name
        print(rfile, '-->', target_name)
        os.rename(rfile, target_name)
        shutil.move(target_name, dst)
