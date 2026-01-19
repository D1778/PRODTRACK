# PRODTRACK
THIS IS A GO PROGRAMMING RELATED PROJECT DEVELOPED BY MCA STUDENTS DINU &amp; KUNNAL - REAL TIME INVENTRY AND PRODUCT STOCK TRACKING FOR A BUSINESS

use of github codes below for setup of the application in vscode :

git codes for group for go programming- prodtrack app
//open the vscode- no need to open any folders - open the terminal and type
> git clone https://github.com/D1778/PRODTRACK.git
//the code will create the folder automatically in your system
//now open file directly from the system as a folder in vscode- the file name is PRODTRACK and
it will be located in your
local disk(c)-> Users-> hp-> PRODTRACK [you see below when you scroll down]
open that in vscode
then you can seee the folders created inside the prodtrack such as backend, frontend and
Readme.md - here is the place you should work on with.
now connect the coding part with github as branches[later will be added to main] through some
git codes that should be typed in the terminal:
always before coding you should do:
> cd PRODTRACK
> git checkout main
>git pull origin main
>git checkout -b feature/creatingHomepage //creatingHomepage is a user defined you give
whenever you code or do any particular edit or rectifications in a particular page you work on.
>git branch //to check which branch youre working on
expected output should be :
* feature/creatingHomepage
 main
//like the above
//next is the part where you code or edit
//after the coding the following code should be typed in the terminal :
> git add .
> git commit -m "Added homepage UI"
//provide appropriate name in the quotes accordingly
>git push -u origin feature/creatingHomepage //Push branch for first time
future push use below code:
> git push
// so by doing these given above things.. the coded part/edits will appear in the github(if you
check our project you'll see it) as a branch and if i accepted it from the github..later i will see the
those updated parts in my vscode too. that's how the git is linked with the vscode.

everytime you start vscode for coding do type the below code at the very beginning to get the updated version:
> git checkout main
> pull origin main


setting up the frontend part of our website using react and its components:
> npm create vite@latest frontend -- --template react
> npm install -D tailwindcss@3 postcss autoprefixer
> npx tailwindcss init -p

to run the react code type the below code:
> npm run dev



