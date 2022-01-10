# ppurge

> Pretty Purge. A cli util that helps you clean up files and directories

![ppurge-gif](https://user-images.githubusercontent.com/15269623/148708443-66a246f2-dc08-4478-a79c-4e97002415e1.gif)

Even with the huge hard drives shipped in modern computers I still find a way to fill them with mountains of dependency and build files and dist folders. For me thats a lot of `node_modules`, `venv`, `*.zip`, `Pods`, `build`, `dist`, and `coverage`. I work on projects and move on, never clean up. I wanted a way to easily clean it all up, `ppurge` is that.

> **WARNING:** This tool deletes files and folders. It defaults to a dryrun mode that 
> only lists the changes it will make. Be safe and be careful. Treat it with the same 
> respect you would `rm -rf /`.

## Install
```
yarn global add ppurge
```
or
```
npm install -g ppurge
```

## Usage
```sh
# Scan current dir for purgable files
ppurge 

# Scan current dir for purgable files and purge them
# Use --purge,-p with caution. ppurge does not provide an interactive
# confirmation prompt. You should run with out -p to confirm
# the keep/purge files then run again with the -p flag.
ppurge --purge

# Scan /projects dir for purgable files
ppurge --root /projects

# Scan current directory and collect size data
ppurge --size

# Scan for all node_modules and collect size data
ppurge -sf '**/node_modules'

# Scan all files in the project dir for node_modules
# and delete them. Skip the exobase-js dir cus your working
# on that right now. Collect size info.
ppurge -psf '**/node_modules;!**/exobase-js' -r ~/projects
```

## The .ppurge File
Pretty purge decides which files to delete and which to keep by reading a `.ppurge` file. Instead of using a file you can pass a `--filter,-f` arg with an inline semicolon seperated list of rules. Simple glob expressions per line. Each line is compared against an absolute path when evaluating. Lines that begin with a bang `!` indicate a directory to keep and skip.

#### Example .ppurge file
```sh
# clean these things
**/node_modules
**/venv
**/*.zip
**/*.pyc
**/build
**/dist
**/Pods

# do not clean this
!**/exobase
```

## Options
```
--purge, -p             defaults to a dry run. will only delete files when this flag is provided
--size, -s              compute file and directory sizes during file search. defaults to skip this so ppurge runs faster
--root, -r              path to directory to use as root of file search. uses cwd when not provided
--filter,-f             a semicolon seperated list of include/exclude rules to act as an inline .ppurge config
--help                  shows this help message
```