# Steps Needed #

0. Need to Rename 'env_Sample' to '.env' and edit the files for configurations
1. You need to create an API key (or multiple keys for multiple sub accounts) in CDC.
2. Remember to restrict IP address in CDC for safety and disable trading if you only using the Bot for order status checking.
3. Go to Telegram's BotFather and create a new Bot (to get the token ID) and add the token ID to .env 'Token'
4. You need to have node.js installed in your computer.
5. Install the prog using command "npm install") and start the prog using command "npm start").
6. Go to telegram and create a chat with the Bot created and run the command "/chatid" to get the your telegram userid. Add the userid to .env (ChatID,tgUserID,tgUserID2). This will restrict the use of the bot to only your telegram account.
7. Lastly, in .env under accountList look for 'apiKey' & 'apiSecret' and add your CDC Api keys in. *Beware!! do not share your api keys with anyone*
8. Restart the prog with 'npm start'
9. To start the monitor of your orders, run the command '/cdcstart'. To stop the monitor use command '/cdcstop'. Can use the command '/keyboard' to turn on the shortcuts command.
