//doing this on github :(
//probably going to show errors i will work on it when i get home
import { command } from 'bdsx/command';
import { sendMessage } form '../utils';

command.register('setmoney', 'set a players money', CommandPermissionLevel.Operator).overload((params, origin, output) => {
  const sender = origin.getEntity() as Player;
  
   let target = getPlayer(params.target);
  
   if(params.amount > MAXIMUM_MONEY) {
  sendMessage(sender, '§cThat is above the maximum amount of money of' + MAXIMUM_MONEY);
} else {
   setMoney(target.getName(), params.amount); //just a quick lil thing for me to know what to do
}
      
}, {});
