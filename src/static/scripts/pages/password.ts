import { textField } from 'material-components-web';
import { postForm, $ } from '../common';
new textField.MDCTextField($('.mdc-text-field'));
postForm("/home");
