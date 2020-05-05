import * as vscode from 'vscode';
import { TaxonomyType } from "../models";
import { CONFIG_KEY, SETTING_ADD_CREATED_IF_EMPTY_ON_SAVE, SETTING_UPDATE_MODIFIED_ON_SAVE, SETTING_DATE_FORMAT, EXTENSION_NAME, SETTING_SLUG_PREFIX, SETTING_SLUG_SUFFIX } from "../constants/settings";
import { format } from "date-fns";
import { ArticleHelper, SettingsHelper } from '../helpers';
import matter = require('gray-matter');


export class Article {

  /**
  * Insert taxonomy
  * 
  * @param type 
  */
  public static async insert(type: TaxonomyType) {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    
    const article = ArticleHelper.getFrontMatter(editor);
    if (!article) {
      return;
    }
    
    let options: vscode.QuickPickItem[] = [];
    const matterProp: string = type === TaxonomyType.Tag ? "tags" : "categories";
    
    // Add the selected options to the options array
    if (article.data[matterProp]) {
      const propData = article.data[matterProp];
      if (propData && propData.length > 0) {
        options = [...propData].map(p => ({
          label: p,
          picked: true
        } as vscode.QuickPickItem));
      }
    }
    
    // Add all the known options to the selection list
    const crntOptions = SettingsHelper.getTaxonomy(type);
    if (crntOptions && crntOptions.length > 0) {
      for (const crntOpt of crntOptions) {
        if (!options.find(o => o.label === crntOpt)) {
          options.push({
            label: crntOpt
          });
        }
      }
    }
    
    if (options.length === 0) {
      vscode.window.showInformationMessage(`${EXTENSION_NAME}: No ${type === TaxonomyType.Tag ? "tags" : "categories"} configured.`);
      return;
    }
    
    const selectedOptions = await vscode.window.showQuickPick(options, { 
      placeHolder: `Select your ${type === TaxonomyType.Tag ? "tags" : "categories"} to insert`,
      canPickMany: true 
    });
    
    if (selectedOptions) {
      article.data[matterProp] = selectedOptions.map(o => o.label);
    }
    
    ArticleHelper.update(editor, article);
  }

  /**
   * Sets the article date
   */
  public static async setDate() {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const article = ArticleHelper.getFrontMatter(editor);
    if (!article) {
      return;
    }

    this.setArticleDate(config, article, 'date');
    ArticleHelper.update(editor, article);
  }


  /**
   * Add the article created if it's emtpy on save
   */
  public static async addCreatedDate(event: vscode.TextDocumentWillSaveEvent) {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);

    const addCreatedIfEmpty = config.get(SETTING_ADD_CREATED_IF_EMPTY_ON_SAVE) as boolean;
    if (!addCreatedIfEmpty) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const article = ArticleHelper.getFrontMatter(editor);
    if (!article || article.data['created']) {
      return;
    }

    this.setArticleDate(config, article, 'created');

    const updateModifiedOnSave = config.get(SETTING_UPDATE_MODIFIED_ON_SAVE) as boolean;
    if (updateModifiedOnSave) {
      this.setArticleDate(config, article, 'modified');
    }

    let update = ArticleHelper.update(editor, article);
    event.waitUntil(Promise.resolve([update]));
  }

  /**
   * Update the article modified on save
   */
  public static async updateModifiedDate(event: vscode.TextDocumentWillSaveEvent) {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);

    const updateModifiedOnSave = config.get(SETTING_UPDATE_MODIFIED_ON_SAVE) as boolean;
    if (!updateModifiedOnSave) {
      return;
    }

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const article = ArticleHelper.getFrontMatter(editor);
    if (!article) {
      return;
    }

    this.setArticleDate(config, article, 'modified');

    let update = ArticleHelper.update(editor, article);
    event.waitUntil(Promise.resolve([update]));
  }

  private static setArticleDate(config: vscode.WorkspaceConfiguration, article: matter.GrayMatterFile<string>, articleKey: string): void {
    const dateFormat = config.get(SETTING_DATE_FORMAT) as string;
    try {
      if (dateFormat && typeof dateFormat === "string") {
        article.data[articleKey] = format(new Date(), dateFormat);
      } else {
        article.data[articleKey] = new Date();
      }
    } catch (e) {
      vscode.window.showErrorMessage(`${EXTENSION_NAME}: Something failed while parsing the date format. Check your "${CONFIG_KEY}${SETTING_DATE_FORMAT}" setting.`);
      console.log(e.message);
    }
  }

  /**
   * Generate the slug based on the article title
   */
	public static generateSlug() {
    const config = vscode.workspace.getConfiguration(CONFIG_KEY);
    const prefix = config.get(SETTING_SLUG_PREFIX) as string;
    const suffix = config.get(SETTING_SLUG_SUFFIX) as string;
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    const article = ArticleHelper.getFrontMatter(editor);
    if (!article || !article.data) {
      return;
    }

    const articleTitle: string = article.data["title"];
    const slug = ArticleHelper.createSlug(articleTitle);
    if (slug) {
      article.data["slug"] = `${prefix}${slug}${suffix}`;
      ArticleHelper.update(editor, article);
    }
	}

  /**
   * Toggle the page its draft mode
   */
  public static async toggleDraft() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    const article = ArticleHelper.getFrontMatter(editor);
    if (!article) {
      return;
    }

    const newDraftStatus = !article.data["draft"];
    article.data["draft"] = newDraftStatus;
    ArticleHelper.update(editor, article);
  }
}
