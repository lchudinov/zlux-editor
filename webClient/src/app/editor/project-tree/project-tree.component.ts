
/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/
import { Component, ViewChild, Inject } from '@angular/core';
import { MatDialog } from '@angular/material';
import { TreeNode, TreeComponent } from 'angular-tree-component';
import { OpenProjectComponent } from '../../shared/dialog/open-project/open-project.component';
import { OpenFolderComponent } from '../../shared/dialog/open-folder/open-folder.component';
import { HttpService } from '../../shared/http/http.service';
import { ENDPOINTS } from '../../../environments/environment';
import { ProjectStructure, DatasetAttributes } from '../../shared/model/editor-project';
import { EditorControlService } from '../../shared/editor-control/editor-control.service';
import { EditorService } from '../editor.service';
import { UtilsService } from '../../shared/utils.service';
import { DataAdapterService } from '../../shared/http/http.data.adapter.service';
import { SnackBarService } from '../../shared/snack-bar.service';
import { Angular2InjectionTokens } from 'pluginlib/inject-resources';
import { FileTreeComponent as ZluxFileTreeComponent } from '@zowe/zlux-angular-file-tree';
import { catchError, switchMap, map } from 'rxjs/operators';
import { of, Observable } from 'rxjs';

function getDatasetName(dirName) {
  let lParenIndex = dirName.indexOf('(');
  let rParenIndex = dirName.lastIndexOf(')');
  if (lParenIndex > 0 && lParenIndex < 46 && rParenIndex == dirName.length-1) {
    return dirName.substring(0,lParenIndex);
  } else {
    return dirName;
  }
}

@Component({
  selector: 'app-project-tree',
  templateUrl: './project-tree.component.html',
  styleUrls: ['./project-tree.component.scss',  '../../../styles.scss'],
})
export class ProjectTreeComponent {

  @ViewChild(ZluxFileTreeComponent)
  private fileExplorer: ZluxFileTreeComponent;

  nodes: ProjectStructure[];

  private scrollConfig = {
    wheelPropagation: true,
  };

  constructor(
    private httpService: HttpService,
    private dataAdapter: DataAdapterService,
    private utils: UtilsService,
    private dialog: MatDialog,
    private editorControl: EditorControlService,
    private snackBarService: SnackBarService,
    private codeEditorService: EditorService,
    @Inject(Angular2InjectionTokens.LOGGER) private log: ZLUX.ComponentLogger) {

    this.editorControl.projectNode.subscribe((nodes) => {
      this.nodes = nodes;
    });

    this.editorControl.closeAllFiles.subscribe(() => {
      this.editorControl.closeAllHandler();
    });

    this.editorControl.undoCloseAllFiles.subscribe(() => {
      this.editorControl.undoCloseAllHandler();
    })

    // TODO: Project interface in general needs to be re-looked at
    this.editorControl.openProject.subscribe(projectName => {
      if (projectName != null) {
        // start get project structure
        // TODO: move these logic to a function
        let requestUrl = this.utils.formatUrl(ENDPOINTS.projectStructure, { name: projectName });
        this.httpService.get(requestUrl)
          .subscribe((response: any) => {
            // TODO: nodes should check project context once the component is loaded.
            // TODO: if there is a file in root directory 'has children' can't be true
            this.nodes = response.datasets.map(r => {
              return {
                name: r,
                hasChildren: true,
              };
            });
            this.editorControl.setProjectNode(this.nodes);
            this.editorControl.initProjectContext(projectName, this.nodes);
          });
      }
    });

    this.editorControl.openDirectory.subscribe(dirName => {
      if (dirName.startsWith('/')) {
        this.editorControl.activeDirectory = dirName;
        this.fileExplorer.updateDirectory(dirName);
      } else {
        let dsName = getDatasetName(dirName);
        this.fileExplorer.updateDSList(dsName);
      }
    });

    this.editorControl.openDataset.subscribe(dirName => {
      if (dirName != null && dirName !== '') {
        if (dirName[0] != '/') {
          dirName = dirName.toUpperCase();
          let isMember = false;
          let dsName = getDatasetName(dirName);
          if (dirName == dsName) {
            let periodPos = dirName.lastIndexOf('.');
            if (periodPos) {
              this.fileExplorer.updateDSList(dirName.substring(0,periodPos+1)+'**');
            } else {
              this.fileExplorer.updateDSList(dirName);
            }
          } else {
            isMember = true;
            this.fileExplorer.updateDSList(dsName);
          }
          // TODO: Validate whether one should be able to open dataset contents via "Open Dataset" instead of displaying them and opening
          // them via true like "Open Directory"
          // let requestUrl = ZoweZLUX.uriBroker.datasetMetadataUri(dirName.toUpperCase(), 'true');
          // this.httpService.get(requestUrl)
          //   .subscribe((response: any) => {
          //     this.nodes = isMember ? this.dataAdapter.convertDatasetMemberList(response) : this.dataAdapter.convertDatasetList(response);
          //     this.editorControl.setProjectNode(this.nodes);
          //     this.editorControl.openFile('',this.nodes[0]).subscribe(x=> {this.log.debug('Dataset opened')});
          //   }, e => {
          //     // TODO
          //   });
        } else {
          this.fileExplorer.updateDirectory(dirName);
        }
      }
    });

    this.editorControl.deleteFile.subscribe(pathAndName => {
      this.fileExplorer.deleteFileOrFolder(pathAndName);
    });

    this.editorControl.createDirectory.subscribe(pathAndName => {
      this.fileExplorer.createDirectory(pathAndName);
    });
  }

  onCopyClick($event: any){
    // Todo: Create right click menu functionality.
  }

  onDeleteClick($event: any){
    // Todo: Create right click menu functionality.
  }

  onNewFileClick($event: any){
    // Todo: Create right click menu functionality.
  }

  onNewFolderClick($event: any){
    // Todo: Create right click menu functionality.
  }

  onNodeClick($event: any){
    if ($event.directory == false) {
      //let nodeData: ProjectStructure = new ProjectStructure();
      const nodeData: ProjectStructure = {
        encoding: $event.ccsid,
        hasChildren: false,
        fileName: $event.name,
        id: $event.id + 1,
        isDataset: false,
        name: $event.name,
        path: $event.path.substring(0, $event.path.length - $event.name.length - 1)
    };
  
      this.editorControl.openFile('', nodeData).subscribe(x => {
        this.log.debug(`File loaded through File Explorer.`);
        this.editorControl.checkForAndSetReadOnlyMode(x.model);
      });
    } else if($event.data.isDataset){
      let data: ProjectStructure = ($event.data as ProjectStructure);
      const isMigrated = data.datasetAttrs && data.datasetAttrs.volser === 'MIGRAT';
      if (isMigrated) {
        const datasetName = data.path.trim();
        this.log.debug(`Dataset ${datasetName} is migrated`);
        this.fileExplorer.recallDataset(datasetName).subscribe(
          datasetAttrs => this.log.info(`dataset ${datasetName} recalled, attrs ${JSON.stringify(datasetAttrs)}, update tree here`),
          _err => this.log.warn(`unable to recall dataset ${datasetName}`)
        );
        return;
        // this.recallDataset(datasetName).subscribe(
        //   datasetAttrs => this.log.info(`dataset ${datasetName} recalled, attrs ${JSON.stringify(datasetAttrs)}, update tree here`),
        //   _err => this.log.warn(`unable to recall dataset ${datasetName}`)
        // );
        // return;
      }
      if($event.type == 'file'){
        this.editorControl.openFile('', (data)).subscribe(x => {
          this.log.debug(`Dataset loaded through File Explorer.`);
          this.editorControl.checkForAndSetReadOnlyMode(x.model);
        });
      }
    }
  }

  // private recallDataset(datasetName: string): Observable<DatasetAttributes> {
  //   const contentsURI = ZoweZLUX.uriBroker.datasetContentsUri(datasetName);
  //   const metadataURI = ZoweZLUX.uriBroker.datasetMetadataUri(datasetName, undefined, undefined, true);
  //   return this.httpService.get(contentsURI)
  //     .pipe(
  //       catchError(_err => of({})),
  //       switchMap(() => this.httpService.get(metadataURI)),
  //       map(data => data.datasets[0]),
  //     );
  // }

  onPathChanged($event: any) {
    this.editorControl.activeDirectory = $event;
  }

  onRenameClick($event: any) {
    // Todo: Create right click menu functionality.
  }

  openProject() {
    let openProjectRef = this.dialog.open(OpenProjectComponent, {
      width: '500px'
    });

    openProjectRef.afterClosed().subscribe(result => {
      if (result) {
        this.editorControl.projectName = result.name;
        this.editorControl.openProject.next(result.name);
      }
    });
  }

  openDirectory() {
    let openDirectoryRef = this.dialog.open(OpenFolderComponent, {
      width: '500px'
    });

    openDirectoryRef.afterClosed().subscribe(result => {
      if (result) {
        this.fileExplorer.showUss();
        this.editorControl.openDirectory.next(result);
      }
    });
  }

  nodeActivate($event: any) {
    if (!$event.node.data.children && !$event.node.data.hasChildren) {
      const nodeData: ProjectStructure = $event.node.data;
      this.editorControl.openFile('', nodeData).subscribe(x => {
        this.log.debug(`NodeData=`,nodeData);
        this.log.debug(`file loaded through project explorer.`);
      });
      // this.editorControl.openFileEmitter.emit(nodeData);
    }
  }

  treeUpdate($event: any) {
    this.editorControl.setProjectNode($event.treeModel.nodes);
    this.editorControl.initProjectContext('', $event.treeModel.nodes);
  }

  nodeIcon(node: TreeNode) {
    let iconName = '';
    if (node.hasChildren) {
      return 'folder';
    } else {
      let openFile = this.editorControl.openFileList.getValue();
      for (let file of openFile) {
        if (file.id === node.data.id) {
          return 'edit';
        }
      }
      return 'assignment';
    }
  }
}

/*
  This program and the accompanying materials are
  made available under the terms of the Eclipse Public License v2.0 which accompanies
  this distribution, and is available at https://www.eclipse.org/legal/epl-v20.html
  
  SPDX-License-Identifier: EPL-2.0
  
  Copyright Contributors to the Zowe Project.
*/
