import {
  Component,
  ElementRef,
  ViewChild,
  OnInit,
  HostListener
} from '@angular/core';
import { Observable, fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';
import { Point } from '../models/Point';
import {
  HubConnectionBuilder,
  HubConnection,
  HttpTransportType
} from '@aspnet/signalr';
import { PathData } from '../models/PathData';

/*
const { remote } = window['require']('electron');
const { Menu, MenuItem } = remote;
*/

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  @ViewChild('board')
  public mainBoardElement: ElementRef;

  public canvasContext: CanvasRenderingContext2D;

  private historyPaths: PathData[] = [];
  private selfCurrentPath: PathData = new PathData();
  private currentPaths: { [key: string]: PathData } = {};
  private selfColor;
  private playLocked: boolean;
  private isConnect = false;
  connection: HubConnection;
  @HostListener('window:focus')
  onFocus() {
    /*
    console.log('focus');
    const menu = Menu.buildFromTemplate([
      {
        label: '編輯',
        submenu: [
          {
            id: 'undo',
            label: '復原',
            click: () => {
              if (
                this.selfCurrentPath &&
                this.selfCurrentPath.path.length === 0
              ) {
                this.historyPaths.pop();
              } else {
                this.selfCurrentPath = new PathData();
              }
              this.draw();
            }
          }
        ]
      }
    ]);

    Menu.setApplicationMenu(menu);*/
  }

  setColor() {
    this.selfColor = prompt('請輸入色碼', '#ff0000');
    this.selfCurrentPath.color = this.selfColor;
  }

  rollback() {
    if (this.selfCurrentPath && this.selfCurrentPath.path.length) {
      this.selfCurrentPath = new PathData();
      this.connection.invoke('updateCurrent', this.selfCurrentPath);
    } else {
      this.connection.invoke('rollback');
    }
  }

  clearHistory() {
    this.connection.invoke('clearHistory');
  }

  ngOnInit(): void {
    this.mainBoardElement.nativeElement.width =
      window.document.body.offsetWidth;
    this.mainBoardElement.nativeElement.height =
      window.document.body.offsetHeight - 25;
    this.canvasContext = this.mainBoardElement.nativeElement.getContext(
      '2d'
    ) as CanvasRenderingContext2D;
    fromEvent(this.mainBoardElement.nativeElement, 'mousemove').subscribe(
      (x: MouseEvent) => {
        switch (x.buttons) {
          case 0: // 提起
            if (this.selfCurrentPath.path.length) {
              this.selfCurrentPath = new PathData();
              this.selfCurrentPath.color = this.selfColor;
              this.connection.invoke('pushCurrent');
              this.connection.invoke('updateCurrent', this.selfCurrentPath);
            }
            break;
          case 1: // 左鍵
            this.selfCurrentPath.path.push({
              x: x.offsetX,
              y: x.offsetY
            });
            this.selfCurrentPath.timing.push(x.timeStamp);

            this.connection.invoke('updateCurrent', this.selfCurrentPath);
            break;
          case 2: // 右鍵
            break;
        }
        this.draw();
      }
    );
    fromEvent<MouseEvent>(this.mainBoardElement.nativeElement, 'mousedown')
      .pipe(filter(x => x.buttons === 1))
      .subscribe(x => {
        if (this.selfCurrentPath.path.length === 0) {
          this.selfCurrentPath.path.push({ x: x.offsetX, y: x.offsetY });
          this.selfCurrentPath.path.push({ x: x.offsetX, y: x.offsetY });

          this.selfCurrentPath.timing.push(x.timeStamp, x.timeStamp);
          this.draw();
          this.connection.invoke('updateCurrent', this.selfCurrentPath);
        }
      });

    this.connection = new HubConnectionBuilder()
      .withUrl('sync' /*, HttpTransportType.LongPolling*/)
      .build();

    this.connection.on('allHistory', data => {
      this.historyPaths = data;
      this.draw();
    });

    this.connection.on('updateCurrent', (id, data) => {
      this.currentPaths[id] = data;
      this.draw();
    });

    this.connection.on('addHistory', data => {
      this.historyPaths.push(data);
      console.log(this.historyPaths);
      this.draw(); // 重繪
    });

    this.connection.on('removeLastHistory', data => {
      this.historyPaths.pop();
      this.draw(); // 重繪
    });

    this.connection.on('clearHistory', data => {
      this.historyPaths = [];
      this.draw(); // 重繪
    });

    this.connection.start().then(() => {
      console.log('連線成功');
      this.isConnect = true;
    });
  }

  public draw() {
    this.canvasContext.clearRect(
      0,
      0,
      this.mainBoardElement.nativeElement.width,
      this.mainBoardElement.nativeElement.height
    );

    for (const path of this.historyPaths) {
      this.canvasContext.beginPath();
      this.canvasContext.lineWidth = 3;
      this.canvasContext.lineCap = 'square';
      this.canvasContext.strokeStyle = path.color || '#ff0000';
      for (let i = 0; i < path.path.length - 1; i++) {
        this.canvasContext.moveTo(path.path[i].x, path.path[i].y);
        this.canvasContext.lineTo(path.path[i + 1].x, path.path[i + 1].y);
      }
      this.canvasContext.stroke();
    }

    // tslint:disable-next-line:forin
    for (const pathKey in this.currentPaths) {
      this.canvasContext.beginPath();
      this.canvasContext.lineWidth = 3;
      this.canvasContext.lineCap = 'square';
      this.canvasContext.strokeStyle =
        this.currentPaths[pathKey].color || '#ff0000';

      for (let i = 0; i < this.currentPaths[pathKey].path.length - 1; i++) {
        this.canvasContext.moveTo(
          this.currentPaths[pathKey].path[i].x,
          this.currentPaths[pathKey].path[i].y
        );
        this.canvasContext.lineTo(
          this.currentPaths[pathKey].path[i + 1].x,
          this.currentPaths[pathKey].path[i + 1].y
        );
      }
      this.canvasContext.stroke();
    }

    this.canvasContext.beginPath();
    this.canvasContext.lineWidth = 3;
    this.canvasContext.lineCap = 'square';
    this.canvasContext.strokeStyle = this.selfCurrentPath.color || '#ff0000';
    for (let i = 0; i < this.selfCurrentPath.path.length - 1; i++) {
      this.canvasContext.moveTo(
        this.selfCurrentPath.path[i].x,
        this.selfCurrentPath.path[i].y
      );
      this.canvasContext.lineTo(
        this.selfCurrentPath.path[i + 1].x,
        this.selfCurrentPath.path[i + 1].y
      );
    }
    this.canvasContext.stroke();
  }
}
