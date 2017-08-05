import * as RandomNGenerator from './Utils/RandomNGenerator'
import * as Constant from './Utils/constants'
import * as Dice from './Models/DiceModel'
import * as DecisionList from './Models/DecisionListState'
import HomeVM from './HomeViewManager';
import DiceVM from './DicePageViewManager';
// import {DiceView} from './DicePageViewManager';
import page from 'page';

// initialize page.js for routing in the front-end
console.log('Home inside index.js:', HomeVM.viewHome);
console.log('DiceView inside index.js:', DiceVM.diceView);

// page.base('/');
page('/', HomeVM.viewHome);
// page('/', () => console.log('Hooome!'));
page('/dice', DiceVM.diceView);
// page('/dice', () => console.log('Im at /dice! \o/'));
page('*', () => console.log('fallback cb'));
// page('/about', viewAbout);
// page('/sign-up', signUp);
// page('/sign-in', signIn);
// page('/sign-out', signOut);
// page('/new', createDice);
page('/dice/:decisionId', DiceVM.diceView);
// page('/:username', userPage);
// page('/:username/:decisionId', viewDice);
// page('/:username/:decisionId/edit', editDice);
// page('/:username/:decisionId/delete', deleteDice);
//
page({ hashbang: false });
