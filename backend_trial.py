files_supported =['pdf','img,jpeg' , 'ppt', 'stuff ']
bw=1.5 #1.5 rs for bw print  
colorp=10.5 #10.5 rs for color print
l=[]
def upload():
  files=input("uploaded file type # [pdf,img,jpeg ,ppt] ")
  if files in files_supported:
     type=input("enter printing type b/w or color")
     if type=="blw":
       pages=int(input('input number of pages of the files i,e all / len of the file '))
       copies=int(input("enter no of copies you need for the same file aka the + sign"))
       price=(copies*pages)*1.5
       l.extend([files, pages,copies,price])
       print(l)
       conti=input("continue and pay to print?")
     elif type=="clr": 
        fr=int(input("enter from "))
        tt=int(input("enter to 'to' page"))
        if fr<tt:
           copies=int(input("enter no of copies ")) #copies are set to 1 in default the user can increase it using the + icon provided 
           pages=int(input("total no of pages ,ie b/w "))-(fr+tt) # this means only the selected pages are printed in color rest is set as to be printed in bw 
           price=(copies*pages)*10*5
           l.extend([files, pages,copies,price])
           print (l)
           conti=intput("continue and pay to print?")
           if conti=="y":
              pay_gatw()
upload()
def pay_gatw():
   #if price is paid and :
   print("file printign....pdf") # this is only  true if and only if the razopay assures and sends back a confirmation


#this is basically how the flask should work i guess 
"""just a model mf dont start rubbing now """