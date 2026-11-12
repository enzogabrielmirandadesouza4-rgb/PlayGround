
(() => {
  'use strict';
  const canvas = document.getElementById('game'), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W=canvas.width,H=canvas.height, world={w:1500,h:960};
  const $=id=>document.getElementById(id);
  const ui={toast:$('toast'),dialogue:$('dialogue'),dialogueText:$('dialogueText'),speaker:$('speaker'),objective:$('objectiveText'),hint:$('interactHint'),health:$('healthFill'),day:$('dayLabel'),loc:$('locationLabel'),inventory:$('inventoryPanel'),craft:$('craftPanel'),start:$('startScreen'),ending:$('endingScreen')};
  const items={wood:0,stone:0,berry:0,meat:0,ore:0,plank:0,workbench:0,house:0,sword:0,key:0};
  const player={x:82,y:105,hp:6,maxHp:6,speed:82,dir:1,walked:0,attackAt:0,invuln:0};
  let started=false,mode='intro',introIndex=0,dialogueDone=null,dialogueLines=[],tutorialStep=0,gameTime=0,days=1,toastTimer=0,anim=0,lastFrame=0,moveKeys={},touchDirs={},camera={x:0,y:0},clickBuffer={entity:null,time:0},boss=null,bossDefeated=false,villageFound=false,castleFound=false,ending=false;
  let entities=[];
  const mk=(type,x,y,extra={})=>({type,x,y,hp:extra.hp??1,maxHp:extra.hp??1,alive:true,...extra});
  const addWorld=()=>{
    entities=[];
    [[175,116],[260,240],[410,110],[485,350],[690,180],[835,430],[1160,210],[1260,680],[910,760],[340,700],[590,555]].forEach(([x,y])=>entities.push(mk('tree',x,y,{hp:4})));
    [[210,185],[350,340],[560,245],[760,590],[980,175],[1140,730],[1320,310],[500,810]].forEach(([x,y])=>entities.push(mk('rock',x,y,{hp:3})));
    [[330,160],[500,470],[780,290],[1050,640],[1250,440]].forEach(([x,y])=>entities.push(mk('ore',x,y,{hp:4})));
    [[130,160],[290,105],[450,255],[650,450],[875,195],[960,520],[1200,350]].forEach(([x,y])=>entities.push(mk('berry',x,y,{hp:1,ready:true,clicks:0})));
    [[118,220],[300,280],[520,115],[720,390],[900,300],[1100,560],[1290,610]].forEach(([x,y],i)=>entities.push(mk(i%2?'wisp':'slime',x,y,{hp:i<2?3:4,maxHp:i<2?3:4,homeX:x,homeY:y,phase:i*1.7,aggro:false})));
    entities.push(mk('village',1040,270,{name:'Vila dos Cogumelos'}));entities.push(mk('castle',1380,500,{name:'Castelo do Rei Demônio'}));
  };
  addWorld();
  function say(text,duration=2100){ui.toast.textContent=text;ui.toast.classList.add('show');toastTimer=duration;}
  function setObjective(text){ui.objective.textContent=text;}
  function openDialogue(speaker,texts,onDone){dialogueLines=texts;introIndex=0;dialogueDone=onDone||null;ui.speaker.textContent=speaker;ui.dialogueText.textContent=texts[0];ui.dialogue.classList.remove('hidden');}
  function nextDialogue(){if(ui.dialogue.classList.contains('hidden'))return;if(introIndex<dialogueLines.length-1){introIndex++;ui.dialogueText.textContent=dialogueLines[introIndex];}else{ui.dialogue.classList.add('hidden');const cb=dialogueDone;dialogueDone=null;if(cb)cb();}}
  function startGame(){if(started)return;started=true;ui.start.classList.add('hidden');mode='intro';openDialogue('NARRADOR',["Depois de um longo dia, você coloca seu novo óculos de realidade virtual.","Uma luz azul preenche tudo. O quarto desaparece — e um vento frio sopra no seu rosto.","Você desperta num prado encantado, cercado por ruínas medievais e criaturas mágicas.","ENZO: Oh meu Deus... onde que eu fui parar!"],()=>beginTutorial());}
  function beginTutorial(){mode='tutorial';tutorialStep=0;setObjective('Aprenda a se mover: use WASD ou as setas.');say('TUTORIAL · MOVA-SE PELO PRADO',2200);}
  function finishTutorial(){mode='survival';tutorialStep=3;setObjective('Construa um lar: reúna madeira e pedra.');openDialogue('ENZO',["Ufa! Essas criaturas deixam carne... e eu vou precisar de abrigo.","Agora começa a aventura de verdade. Junte recursos, construa e descubra este mundo.","Dizem que há uma vila ao leste... e um castelo sombrio além dela."],()=>say('TUTORIAL CONCLUÍDO · SUA AVENTURA COMEÇA!',2600));}
  function startEnding(){if(ending)return;ending=true;mode='ending';openDialogue('NARRADOR',["Com um último golpe, o Rei Demônio cai. O castelo inteiro estremece.","Entre os destroços, você encontra uma chave dourada. A porta atrás do trono se abre.","Uma luz familiar envolve você. O visor se desprende — seu quarto está de volta.","ENZO: O meu Deus, finalmente estou aqui de novo!"],()=>{ui.ending.classList.remove('hidden');$('endingStats').textContent=`DIA ${days}  ·  CASA ${items.house?'CONSTRUÍDA':'NÃO CONSTRUÍDA'}  ·  VILA ${villageFound?'DESCOBERTA':'NÃO DESCOBERTA'}`;});}
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function nearestEntity(max=40,types=null){let best=null,d=max;for(const e of entities){if(!e.alive||types&&!types.includes(e.type))continue;const n=distance(player,e);if(n<d){best=e;d=n;}}return best;}
  function give(name,n=1){items[name]=(items[name]||0)+n;updatePanels();}
  function updatePanels(){
    const names={wood:'▤ Madeira',stone:'◈ Pedra',berry:'✿ Frutas',meat:'◆ Carne',ore:'⬡ Minério',plank:'▥ Tábuas',workbench:'⚒ Bancada',house:'⌂ Casa',sword:'⚔ Espada',key:'⚿ Chave'};
    $('inventoryGrid').innerHTML=Object.entries(names).map(([k,v])=>`<div class="item-slot">${v}<b>${items[k]||0}</b></div>`).join('');
    $('statsLine').textContent=`VIDA ${player.hp}/${player.maxHp}  ·  DIA ${days}  ·  ${villageFound?'VILA DESCOBERTA':'VILA NÃO ENCONTRADA'}`;
    const recipes=[['workbench','Bancada de trabalho','8 madeira · 4 pedra',()=>items.wood>=8&&items.stone>=4,()=>{items.wood-=8;items.stone-=4;items.workbench++;say('BANCADA CONSTRUÍDA!');}],['house','Casa de madeira','15 madeira · 5 pedra · bancada',()=>items.wood>=15&&items.stone>=5&&items.workbench>0,()=>{items.wood-=15;items.stone-=5;items.house++;player.maxHp=8;player.hp=8;say('SUA CASA ESTÁ PRONTA · VIDA MÁXIMA AUMENTOU!');}],['sword','Espada de ferro','5 minério · 3 madeira · bancada',()=>items.ore>=5&&items.wood>=3&&items.workbench>0,()=>{items.ore-=5;items.wood-=3;items.sword++;say('ESPADA FORJADA · ATAQUE MAIS FORTE!');}]];
    $('recipeList').innerHTML=recipes.map(([key,title,cost,can])=>`<div class="recipe"><div><b>${title}${items[key]?' ✓':''}</b><small>${cost}</small></div><button data-recipe="${key}" ${can()?'':'disabled'}>${items[key]?'CONSTRUÍDO':'CRIAR'}</button></div>`).join('')+'<div class="recipe-note">Dica: clique em árvores 4 vezes, pedras 3 vezes e minério 4 vezes. Clique duas vezes nas frutas.</div>';
    $('recipeList').querySelectorAll('[data-recipe]').forEach(btn=>btn.onclick=()=>{const r=recipes.find(x=>x[0]===btn.dataset.recipe);if(r&&r[3]()){r[4]();updatePanels();checkProgress();}});
  }
  function updateHealth(){ui.health.style.width=`${Math.max(0,player.hp/player.maxHp*100)}%`;updatePanels();}
  function target(e){if(!e||!e.alive)return;const now=performance.now();
    if(distance(player,e)>36){ui.hint.textContent='CHEGUE MAIS PERTO';ui.hint.classList.add('show');say('Chegue mais perto para interagir.');return;}ui.hint.classList.remove('show');
    if(e.type==='tree'||e.type==='rock'||e.type==='ore'){e.hp--;const left=e.hp;if(left<=0){e.alive=false;const resource={tree:['wood',3],rock:['stone',2],ore:['ore',2]}[e.type];give(resource[0],resource[1]);say(`${resource[1]} ${resource[0]==='wood'?'MADEIRA':resource[0]==='stone'?'PEDRA':'MINÉRIO'} COLETADA!`);if(mode==='tutorial'&&e===tutorialTree){tutorialStep=2;setObjective('Agora derrote a criatura mágica e pegue comida.');say('ÁRVORE QUEBRADA · +3 MADEIRA');}checkProgress();}else say(`${e.type==='tree'?'ÁRVORE':e.type==='rock'?'PEDRA':'MINÉRIO'} · ${left} TOQUES RESTANTES`);anim=8;return;}
    if(e.type==='berry'){if(now-clickBuffer.time<650&&clickBuffer.entity===e){give('berry',2);e.alive=false;clickBuffer={entity:null,time:0};say('FRUTAS SILVESTRES COLETADAS · +2');}else{clickBuffer={entity:e,time:now};say('MAIS UM CLIQUE PARA COLHER');}return;}
    if(e.type==='slime'||e.type==='wisp'||e.type==='demon'){if(e.type==='demon'&&!items.sword){say('SUA ARMA NÃO É FORTE O BASTANTE · FORJE UMA ESPADA!');return;}if(now-player.attackAt<350)return;player.attackAt=now;const damage=items.sword?2:1;e.hp-=damage;anim=12;if(e.hp<=0){e.alive=false;if(e.type==='demon'){bossDefeated=true;items.key=1;say('REI DEMÔNIO DERROTADO · PEGUE A CHAVE!');openDialogue('ENZO',["Consegui! O rei demônio foi derrotado!","A chave... ela deve abrir aquela porta!"],()=>setObjective('Pegue a chave dourada no castelo.'));}else{give('meat',1);say('CRIATURA DERROTADA · +1 CARNE');if(mode==='tutorial'&&e===tutorialSlime)finishTutorial();checkProgress();}}else say(`${e.type==='demon'?'REI DEMÔNIO':e.type==='wisp'?'FADA SOMBRIA':'SLIME'} · ${e.hp} VIDA`);return;}
    if(e.type==='village'){if(!villageFound){villageFound=true;say('VILA DOS COGUMELOS DESCOBERTA!');openDialogue('MORADORA DA VILA',["Seja bem-vindo, viajante! O castelo do Rei Demônio fica a leste, depois das montanhas.","Você pode ficar por aqui... mas cuidado com as criaturas da noite."],()=>checkProgress());}else say('VILA DOS COGUMELOS · UM LUGAR PARA CHAMAR DE LAR');}
    if(e.type==='castle'){if(!castleFound){castleFound=true;openDialogue('ENZO',["O Castelo do Rei Demônio! É aqui que tudo termina.","Mas preciso de uma espada de ferro antes de entrar."],()=>checkProgress());}else if(bossDefeated&&items.key)startEnding();else if(!boss){boss=mk('demon',e.x-35,e.y-5,{hp:12,maxHp:12});entities.push(boss);setObjective('Derrote o Rei Demônio com sua espada.');say('O REI DEMÔNIO APARECE!');}else say('DERROTE O REI DEMÔNIO E PEGUE A CHAVE.');}
  }
  let tutorialTree,tutorialSlime;
  function checkProgress(){if(mode==='survival'){if(!items.workbench)setObjective('Reúna 8 madeira e 4 pedra para uma bancada.');else if(!items.house)setObjective('Construa sua casa: 15 madeira e 5 pedra.');else if(!villageFound)setObjective('Explore o mundo e encontre a Vila dos Cogumelos.');else if(!items.sword)setObjective('Minere 5 ferros e crie uma espada na bancada.');else if(!bossDefeated)setObjective('Vá ao Castelo do Rei Demônio e derrote-o.');else if(items.key)setObjective('Use a chave dourada na porta do castelo!');}}
  tutorialTree=entities.find(e=>e.type==='tree'&&e.x===175);tutorialSlime=entities.find(e=>e.type==='slime'&&e.x===118);
  function actNearest(){const enemy=nearestEntity(52,['slime','wisp','demon']);const e=enemy||nearestEntity(52,['tree','rock','ore','berry','village','castle']);if(e)target(e);else say('Não há nada por perto para interagir.');}
  function entityAt(wx,wy){let best=null,bd=19;for(const e of entities){if(!e.alive)continue;const r=e.type==='tree'?19:e.type==='village'?26:e.type==='castle'?30:e.type==='demon'?20:13;const d=Math.hypot(e.x-wx,e.y-wy);if(d<r&&d<bd){best=e;bd=d;}}return best;}
  function handleCanvasClick(ev){if(!started||!ui.dialogue.classList.contains('hidden')||mode==='ending')return;const rect=canvas.getBoundingClientRect(),sx=canvas.width/rect.width,sy=canvas.height/rect.height;const px=(ev.clientX-rect.left)*sx,py=(ev.clientY-rect.top)*sy;const e=entityAt(px+camera.x,py+camera.y);if(e)target(e);else actNearest();}
  canvas.addEventListener('pointerdown',handleCanvasClick);
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);}
  function text(t,x,y,color='#e9e4ca',size=6,align='left'){ctx.fillStyle=color;ctx.font=`${size}px monospace`;ctx.textAlign=align;ctx.fillText(t,Math.round(x),Math.round(y));ctx.textAlign='left';}
  function drawTree(x,y){rect(x-9,y-2,18,8,'#674b35');rect(x-13,y-17,26,17,'#315c43');rect(x-10,y-23,20,12,'#42764d');rect(x-5,y-27,10,7,'#59865a');rect(x-8,y-9,5,4,'#68905a');rect(x+5,y-18,5,4,'#588452');rect(x-2,y-2,4,8,'#96704a');}
  function drawRock(x,y,ore=false){rect(x-10,y-5,20,9,'#667579');rect(x-7,y-9,13,5,'#889596');rect(x-4,y-11,6,3,'#9eaaa5');rect(x-7,y+1,14,2,'#485c62');if(ore){rect(x-3,y-5,3,3,'#e1ae61');rect(x+3,y-2,3,2,'#bf8056');}}
  function drawBerry(x,y){rect(x-8,y-2,16,5,'#426d47');rect(x-4,y-7,3,4,'#619657');rect(x+3,y-6,3,4,'#619657');rect(x-5,y-1,4,4,'#d77980');rect(x+2,y-3,4,4,'#e99b79');rect(x,y-7,3,3,'#d27991');}
  function drawCreature(e,x,y){if(e.type==='slime'){rect(x-8,y-5,16,8,'#55b59a');rect(x-6,y-9,12,5,'#73d3ad');rect(x-4,y-2,2,2,'#183b43');rect(x+3,y-2,2,2,'#183b43');rect(x-3,y+1,6,1,'#275e58');}
    else if(e.type==='wisp'){rect(x-6,y-8,12,12,'#9a82d1');rect(x-4,y-11,8,7,'#c0abe5');rect(x-3,y-4,2,2,'#fff0c8');rect(x+2,y-4,2,2,'#fff0c8');rect(x-9,y+3,4,2,'#8271ba');rect(x+5,y+3,4,2,'#8271ba');}
    else{rect(x-12,y-11,24,16,'#342c3b');rect(x-9,y-17,18,9,'#51414a');rect(x-10,y-21,5,8,'#8e4e53');rect(x+5,y-21,5,8,'#8e4e53');rect(x-7,y-8,4,3,'#ffb35f');rect(x+3,y-8,4,3,'#ffb35f');rect(x-9,y+5,7,5,'#503b41');rect(x+3,y+5,7,5,'#503b41');}
    if(e.type!=='demon'&&e.hp<e.maxHp){rect(x-7,y-14,14,2,'#493b40');rect(x-7,y-14,Math.max(1,14*e.hp/e.maxHp),2,'#eb8371');}}
  function drawVillage(x,y){rect(x-24,y-11,47,19,'#775844');rect(x-27,y-16,53,8,'#9e7454');rect(x-20,y-21,39,7,'#bd8b5c');rect(x-15,y-4,8,8,'#e5bd76');rect(x+5,y-5,9,13,'#433c3c');rect(x-3,y-24,6,9,'#d8c384');rect(x-2,y-31,4,7,'#ecddaa');text('VILA',x,y+16,'#fff0ba',5,'center');}
  function drawCastle(x,y){rect(x-29,y-19,58,25,'#4a4854');rect(x-35,y-30,15,37,'#5e5964');rect(x+20,y-30,15,37,'#5e5964');rect(x-14,y-25,28,31,'#514d59');rect(x-38,y-37,21,8,'#78626a');rect(x+17,y-37,21,8,'#78626a');rect(x-17,y-33,34,8,'#77606a');rect(x-8,y-8,16,15,'#272634');rect(x-2,y-2,4,9,'#d9ac63');rect(x-3,y-41,6,10,'#b7494e');text('CASTELO',x,y+15,'#eed0a0',5,'center');}
  function drawPlayer(x,y){const bob=player.walked%1>.5?1:0;rect(x-5,y-3+bob,10,8,'#315e69');rect(x-4,y-10+bob,8,8,'#e4b894');rect(x-5,y-12+bob,10,4,'#453a39');rect(x-3,y-6+bob,2,2,'#273b3d');rect(x+2,y-6+bob,2,2,'#273b3d');rect(x-5,y+4+bob,4,4,'#293b50');rect(x+1,y+4+bob,4,4,'#293b50');if(items.sword){rect(x+6*player.dir,y-4,2,10,'#d9d4bf');rect(x+4*player.dir,y+2,6,2,'#a8794d');}}
  function drawGround(){
    const gx=Math.floor(camera.x/16),gy=Math.floor(camera.y/16);
    for(let ty=0;ty<Math.ceil(H/16)+1;ty++)for(let tx=0;tx<Math.ceil(W/16)+1;tx++){
      const wx=(gx+tx)*16,wy=(gy+ty)*16,x=tx*16-camera.x%16,y=ty*16-camera.y%16;
      let col='#52744e';if(wx>700&&wy>350&&wy<650)col='#63734a';if(wx>1260)col='#5b6250';rect(x,y,16,16,col);
      const seed=(Math.abs(wx*13+wy*7)%17);if(seed===0)rect(x+4,y+5,2,2,'#77905b');else if(seed===4)rect(x+11,y+10,2,2,'#3f6649');else if(seed===8)rect(x+7,y+13,1,1,'#a29a62');
    }
    // Winding, softly worn trail to the eastern village and northern castle.
    ctx.strokeStyle='#a18b61';ctx.lineWidth=7;ctx.lineCap='square';ctx.beginPath();ctx.moveTo(500-camera.x,450-camera.y);ctx.lineTo(760-camera.x,360-camera.y);ctx.lineTo(1040-camera.x,270-camera.y);ctx.lineTo(1200-camera.x,350-camera.y);ctx.lineTo(1380-camera.x,500-camera.y);ctx.stroke();
    ctx.strokeStyle='#b49b69';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(500-camera.x,448-camera.y);ctx.lineTo(760-camera.x,358-camera.y);ctx.lineTo(1040-camera.x,268-camera.y);ctx.lineTo(1200-camera.x,348-camera.y);ctx.lineTo(1380-camera.x,498-camera.y);ctx.stroke();
    // Lake in the western meadow.
    rect(2-camera.x,570-camera.y,185,80,'#3f7880');rect(14-camera.x,580-camera.y,152,58,'#498b8a');rect(26-camera.x,576-camera.y,4,2,'#a4c5a0');rect(81-camera.x,618-camera.y,6,2,'#a4c5a0');
  }
  function drawScene(){
    drawGround();
    // Forest edge and distant mountain silhouettes.
    for(let i=0;i<9;i++){let x=i*190+35-camera.x,y=23-camera.y*.35;rect(x,y,36,32,'#405549');rect(x+8,y-10,23,10,'#52634d');rect(x+16,y-18,14,9,'#647052');}
    for(const e of entities){if(!e.alive)continue;const x=e.x-camera.x,y=e.y-camera.y;if(x<-50||x>W+50||y<-50||y>H+50)continue;
      if(e.type==='tree')drawTree(x,y);else if(e.type==='rock')drawRock(x,y);else if(e.type==='ore')drawRock(x,y,true);else if(e.type==='berry')drawBerry(x,y);else if(e.type==='village')drawVillage(x,y);else if(e.type==='castle')drawCastle(x,y);else drawCreature(e,x,y);
    }
    drawPlayer(player.x-camera.x,player.y-camera.y);
    // Tutorial labels and nearby interaction focus.
    if(mode==='tutorial'&&tutorialStep<3){const e=tutorialStep<2?tutorialTree:tutorialSlime;if(e&&e.alive){const x=e.x-camera.x,y=e.y-camera.y-30;text(tutorialStep<2?'4×':'!',x,y,'#fff0b0',7,'center');}}
    const targetE=nearestEntity(34,['tree','rock','ore','berry','slime','wisp','demon','village','castle']);
    if(targetE){const x=targetE.x-camera.x,y=targetE.y-camera.y-27;rect(x-5,y-3,10,7,'#152630dd');text('E',x,y+2,'#ffe19a',6,'center');}
    // A compact explorer compass.
    rect(8,40,52,34,'#142733c9');rect(9,41,50,32,'#d8c584');rect(10,42,48,30,'#597b58');rect(12,61,15,7,'#457f83');rect(41,49,10,8,'#514d59');rect(42,56,3,3,'#a78e5d');rect(10+Math.round(player.x/world.w*45),42+Math.round(player.y/world.h*27),3,3,'#f3d16f');text('N',56,47,'#f4dfaa',5,'center');
    if(boss&&boss.alive&&distance(player,boss)<230){rect(100,10,120,5,'#432d36');rect(101,11,118*Math.max(0,boss.hp/boss.maxHp),3,'#ce6d6c');text('REI DEMÔNIO',160,8,'#fff0cc',5,'center');}
  }
  function getLocation(){if(player.x<240&&player.y<280)return'PRADO DO DESPERTAR';if(player.x>930&&player.y<360)return'VILA DOS COGUMELOS';if(player.x>1250&&player.y>400)return'CASTELO DO REI DEMÔNIO';if(player.x>650&&player.x<1200)return'CAMINHO DAS MONTANHAS';if(player.y>560)return'LAGO DAS FADAS';return'FLORESTA ENCANTADA';}
  function update(dt){if(!started||!ui.dialogue.classList.contains('hidden')||mode==='ending')return;
    gameTime+=dt;const speed=player.speed*(moveKeys.shift?1.45:1);let dx=0,dy=0;if(moveKeys.w||moveKeys.ArrowUp||touchDirs.up)dy--;if(moveKeys.s||moveKeys.ArrowDown||touchDirs.down)dy++;if(moveKeys.a||moveKeys.ArrowLeft||touchDirs.left)dx--;if(moveKeys.d||moveKeys.ArrowRight||touchDirs.right)dx++;
    if(dx||dy){const len=Math.hypot(dx,dy);dx/=len;dy/=len;player.x=Math.max(10,Math.min(world.w-10,player.x+dx*speed*dt));player.y=Math.max(10,Math.min(world.h-10,player.y+dy*speed*dt));player.walked+=dt*7;if(dx)player.dir=dx>0?1:-1;}
    if(mode==='tutorial'&&tutorialStep===0&&player.walked>1.8){tutorialStep=1;setObjective('Boa! Vá até a árvore marcada e clique nela 4 vezes.');say('MOVIMENTO APRENDIDO · ENCONTRE A ÁRVORE MARCADA');}
    camera.x=Math.max(0,Math.min(world.w-W,player.x-W/2));camera.y=Math.max(0,Math.min(world.h-H,player.y-H/2));
    for(const e of entities){if(!e.alive||!['slime','wisp','demon'].includes(e.type))continue;e.phase+=dt;
      const dist=distance(player,e),aggroRange=e.type==='demon'?170:90;if(dist<aggroRange){e.aggro=true;if(dist>15){const velocity=e.type==='demon'?15:11;e.x+=(player.x-e.x)/dist*velocity*dt;e.y+=(player.y-e.y)/dist*velocity*dt;}}
      else if(e.type!=='demon'){e.x=e.homeX+Math.cos(e.phase)*7;e.y=e.homeY+Math.sin(e.phase*1.3)*5;}
      if(dist<21&&player.invuln<=0){player.hp--;player.invuln=1.05;updateHealth();say(e.type==='demon'?'O REI DEMÔNIO ATINGIU VOCÊ!':'Uma criatura te atingiu! · Use F para comer');if(player.hp<=0){player.hp=Math.max(2,Math.floor(player.maxHp/2));player.x=82;player.y=105;player.invuln=2;updateHealth();say('Você acordou de volta no prado. Recupere o fôlego!');}}
    }
    player.invuln=Math.max(0,player.invuln-dt);if(gameTime>days*105){days++;ui.day.textContent=`DIA ${days}`;updatePanels();}
    ui.loc.textContent=getLocation();if(toastTimer>0){toastTimer-=dt*1000;if(toastTimer<=0)ui.toast.classList.remove('show');}
    if(mode==='tutorial'&&tutorialStep>=2&&tutorialSlime&&!tutorialSlime.alive&&mode==='tutorial')finishTutorial();
  }
  function frame(t){const dt=Math.min(.04,(t-lastFrame)/1000||0);lastFrame=t;update(dt);ctx.clearRect(0,0,W,H);drawScene();requestAnimationFrame(frame);}
  $('startBtn').addEventListener('click',startGame);$('dialogueNext').addEventListener('click',nextDialogue);ui.dialogue.addEventListener('pointerdown',e=>{if(e.target.id!=='dialogueNext')nextDialogue();});
  $('inventoryBtn').onclick=()=>{updatePanels();ui.inventory.classList.toggle('hidden');ui.craft.classList.add('hidden');};$('craftBtn').onclick=()=>{updatePanels();ui.craft.classList.toggle('hidden');ui.inventory.classList.add('hidden');};
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.parentElement.classList.add('hidden'));$('helpBtn').onclick=()=>openDialogue('COMO JOGAR',["Ande com WASD ou setas (no celular, use o direcional).","Clique uma vez em árvores (4 toques), rochas (3) e minérios (4). Clique duas vezes num arbusto para colher.","Clique em criaturas perto de você para atacar. Coma frutas ou carne com F para recuperar vida.","Construa bancada, casa e espada. Descubra a vila e derrote o Rei Demônio!"]);$('touchAction').onclick=actNearest;
  window.addEventListener('keydown',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();if(k==='i'||k==='I'){ui.inventory.classList.toggle('hidden');ui.craft.classList.add('hidden');updatePanels();}if(k==='c'||k==='C'){ui.craft.classList.toggle('hidden');ui.inventory.classList.add('hidden');updatePanels();}if(k==='e'||k==='E')actNearest();if(k==='f'||k==='F'){const food=items.berry>0?'berry':items.meat>0?'meat':null;if(food&&player.hp<player.maxHp){items[food]--;player.hp=Math.min(player.maxHp,player.hp+(food==='meat'?3:2));updateHealth();say(food==='meat'?'CARNE COMIDA · +3 VIDA':'FRUTAS COMIDAS · +2 VIDA');}else if(!food)say('SEM COMIDA · ENCONTRE FRUTAS OU CRIATURAS');else say('VOCÊ JÁ ESTÁ COM VIDA CHEIA!');}if(k===' '&&!started)startGame();if(k==='Enter'&&!ui.dialogue.classList.contains('hidden'))nextDialogue();if(!ui.inventory.classList.contains('hidden')||!ui.craft.classList.contains('hidden')){if(!['i','I','c','C','Escape'].includes(k))return;}moveKeys[k]=true;});
  window.addEventListener('keyup',e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;moveKeys[k]=false;});window.addEventListener('blur',()=>{moveKeys={};touchDirs={};});
  document.querySelectorAll('[data-dir]').forEach(btn=>{const dir=btn.dataset.dir;btn.addEventListener('pointerdown',e=>{e.preventDefault();touchDirs[dir]=true;btn.setPointerCapture(e.pointerId);});for(const ev of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(ev,()=>touchDirs[dir]=false);});
  $('restartBtn').onclick=()=>location.reload();updatePanels();requestAnimationFrame(frame);
})();
