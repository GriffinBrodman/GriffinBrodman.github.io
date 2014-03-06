tempy=$(curl http://www.movies.com/rss-feeds/top-ten-box-office-rss 2> /dev/null) 

titles=$tempy | grep "title" | sed 's/<title><![CDATA[//' | sed 's_</title>__' 

des=$tempy | grep "description" | sed 's/<description><![CDATA[//' | sed 's_</description>__' 

IFS=$'\n'

desArray=($(cat des))

echo "$titles"