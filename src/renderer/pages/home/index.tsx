import React, { ChangeEventHandler, useEffect, useRef, useState } from "react";
import { connect } from "dva";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Icon,
  Input,
  message,
  Modal,
  Switch,
  Table,
  Tabs,
  Tree
} from "antd";
import { Dispatch } from "redux";
import { StateType } from "@/pages/home/model";
import { TreeProps } from "antd/es/tree";
import { TreeNodeNormal } from "antd/es/tree/Tree";
import { ZkACL } from "@/utils/ZkClient";
import logEvent from "../../utils/LogEvent";
import { Event } from "node-zookeeper-client";

import style from "./style.less";
import logo from "../../assets/logo.png";
import { ColumnProps } from "antd/lib/table";
import { Row } from "antd/lib/grid";
import CreateNodeForm from "@/pages/home/components/CreateNodeForm";
import moment from "moment";
import { useLocalStorageState } from "@umijs/hooks";

let electron = window.require("electron");

const { TreeNode } = Tree;
const { TextArea } = Input;
const { TabPane } = Tabs;
const ButtonGroup = Button.Group;

const IconFont = Icon.createFromIconfontCN({
  scriptUrl: "http://at.alicdn.com/t/font_1396433_j73yygrrl3r.js"
});

interface HomeProps {
  home: StateType;
  dispatch: Dispatch;
}

let logArr: string[] = [];

function Home(props: HomeProps) {
  const { dispatch } = props;

  const [url, setUrl] = useLocalStorageState("url", "127.0.0.1:2181");
  const [splitPos, setSplitPos] = useLocalStorageState("splitPos", 600);
  const [isAuto, setIsAuto] = useLocalStorageState("isAuto", false);

  const [treeData, setTreeData] = useState<TreeNodeNormal[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(false);

  const [rootNode, setRootNode] = useState("/");
  const [nodePath, setNodePath] = useState("");
  const [nodeName, setNodeName] = useState("");
  const [nodeData, setNodeData] = useState("");
  const [nodeStat, setNodeStat] = useState([]);
  const [nodeACL, setNodeACL] = useState<ZkACL>(new ZkACL("", "", ""));
  const [createNodeVisible, setCreateNodeVisible] = useState(false);
  const [log, setLog] = useState("");
  const [decodeURI, setDecodeURI] = useState(false);

  const logDiv = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEvent.on("log", (args: any) => {
      logArr.length >= 50 && logArr.shift();
      logArr.push(
        `${moment().format("YYYY-MM-DD HH:mm:ss SSS")}:   ${args.toString()}`
      );
      setLog(logArr.join("\n"));
      if (logDiv.current != null) {
        logDiv.current.scrollTop = logDiv.current.scrollHeight;
      }
    });
  }, []);

  const connect = () => {
    dispatch({
      type: "home/connect",
      payload: { url },
      callback() {
        refreshRootTreeNode();
        setNodePath("/");
        message.success("连接成功");
      }
    });
  };
  const event: any = (event: Event) => {
    logEvent.emit("log", event);
    refreshRootTreeNode();
  };

  const refreshRootTreeNode = () => {
    dispatch({
      type: "home/getChildrenTree",
      payload: { rootNode },
      callback(data: TreeNodeNormal[]) {
        setTreeData(data);
        message.success("刷新成功");
      },
      event: isAuto ? event : undefined
    });
  };

  const close = async () => {
    return new Promise(resolve => {
      dispatch({
        type: "home/close",
        callback() {
          setExpandedKeys([]);
          setTreeData([]);
          setNodePath("");
          setNodeName("");
          setNodeData("");
          setNodeACL(new ZkACL("", "", ""));
          message.success("断开连接成功");
          resolve();
        }
      });
    });
  };

  const renderTreeNodes = (data: TreeNodeNormal[]) =>
    data.map(item => {
      const oldTitle = item.title as string;
      const index = oldTitle.indexOf(searchValue);
      const beforeStr = oldTitle.substr(0, index);
      const afterStr = oldTitle.substr(index + searchValue.length);
      let title = item.title;
      if (index > -1) {
        title = (
          <span>
            {beforeStr}
            <span style={{ color: "#f50", backgroundColor: "#3390FF" }}>
              {searchValue}
            </span>
            {afterStr}
          </span>
        );
      }
      if (item.children && item.children.length > 0) {
        return (
          <TreeNode
            key={item.key}
            title={title}
            dataRef={item}
            // icon={<IconFont type="icon-folder" style={{ fontSize: 20 }} />}
          >
            {renderTreeNodes(item.children)}
          </TreeNode>
        );
      }
      return (
        <TreeNode
          key={item.key}
          title={title}
          dataRef={item}
          // icon={<IconFont type="icon-wenjian-" style={{ fontSize: 20 }} />}
        />
      );
    });

  const getParentKey = (key: string, tree: TreeNodeNormal[]) => {
    let parentKey: string = "";
    for (let i = 0; i < tree.length; i++) {
      const node = tree[i];
      if (node.children) {
        if (node.children.some(item => item.key === key)) {
          parentKey = node.key;
        } else if (getParentKey(key, node.children)) {
          parentKey = getParentKey(key, node.children);
        }
      }
    }
    return parentKey;
  };

  const onSelectChange: ChangeEventHandler<HTMLInputElement> = e => {
    const value = e.target.value;
    const dataList: { key: string; title: string }[] = [];
    const generateList = (data: TreeNodeNormal[]) => {
      for (let i = 0; i < data.length; i++) {
        const node = data[i];
        const { key } = node;
        dataList.push({ key, title: key });
        if (node.children) {
          generateList(node.children);
        }
      }
    };
    generateList(treeData);
    const expandedKeys = dataList
      .map(item => {
        if (item.title.indexOf(value) > -1) {
          return getParentKey(item.key, treeData);
        }
        return null;
      })
      .filter((item, i, self) => item && self.indexOf(item) === i);
    setSearchValue(value);
    setExpandedKeys(expandedKeys as string[]);
    setAutoExpandParent(true);
  };

  const onExpand = (expandedKeys: string[]) => {
    setExpandedKeys(expandedKeys);
    setAutoExpandParent(false);
  };

  const onSelectTree: TreeProps["onSelect"] = (selectedKeys, e) => {
    setSelectedKeys(selectedKeys);
    if (selectedKeys.length === 0) {
      setNodeName("");
      setNodePath("/");
      setNodeData("");
      setNodeStat([]);
      setNodeACL(new ZkACL("", "", ""));
    } else {
      setNodeName((e.node.props.title as any).props.children[2]);
      const path = e.node.props.eventKey as string;
      setNodePath(path);
      dispatch({
        type: "home/getData",
        payload: { path },
        callback(data: [string, []]) {
          setNodeData(data[0]);
          setNodeStat(data[1]);
        }
      });
      dispatch({
        type: "home/getACL",
        payload: { path },
        callback(nodeACL: ZkACL) {
          setNodeACL(nodeACL);
        }
      });
    }
  };

  const onSetData = () => {
    dispatch({
      type: "home/setData",
      payload: { path: nodePath, data: nodeData },
      callback() {
        message.success(`${nodePath}节点值更新成功`);
      }
    });
  };

  const onCreate = (values: any) => {
    let path = `${nodePath}${nodePath === "/" ? "" : "/"}${values.zkNodeName}`;
    dispatch({
      type: "home/create",
      payload: {
        path,
        nodeData: values.nodeData
      },
      callback() {
        message.success(`${path}节点新增成功`);
      }
    });
    setCreateNodeVisible(false);
  };

  const onRemove = () => {
    if (nodePath) {
      Modal.confirm({
        title: "警告",
        content: "您确定要删除此节点以及子节点吗？",
        onOk: () => {
          return new Promise(resolve => {
            dispatch({
              type: "home/remove",
              payload: { path: nodePath },
              callback() {
                message.success(`${nodePath}节点值删除成功`);
                resolve();
              }
            });
          });
        }
      });
    }
  };

  const columns: ColumnProps<{}>[] = [
    {
      title: "名称",
      dataIndex: "name",
      width: 150
    },
    {
      title: "值",
      dataIndex: "value",
      width: 200
    },
    {
      title: "真实值",
      dataIndex: "realValue",
      ellipsis: true
    },
    {
      title: "描述",
      dataIndex: "description",
      ellipsis: true
    }
  ];

  const leftCard = (
    <Card
      style={{
        // overflow: "auto",
        height: "91vh",
        marginRight: 15
      }}
      bordered={false}
    >
      {/*<Row type={"flex"} align={"middle"} justify={"space-between"}>*/}
      {/*  <Col>*/}
      {/*    <span className={style.cardTitle}>节点选项</span>*/}
      {/*  </Col>*/}
      {/*<Col>*/}
      {/*  <Input*/}
      {/*    placeholder="根节点"*/}
      {/*    onChange={e => setRootNode(e.target.value)}*/}
      {/*  />*/}
      {/*</Col>*/}
      {/*  <Col>*/}
      {/*    <Button type={"primary"} onClick={connect} style={{ marginRight: 5 }}>*/}
      {/*      连接*/}
      {/*    </Button>*/}
      {/*    <Button type={"primary"} onClick={close}>*/}
      {/*      断开*/}
      {/*    </Button>*/}
      {/*  </Col>*/}
      {/*</Row>*/}
      <Row type={"flex"} align={"middle"} justify={"space-between"}>
        <Col span={14}>
          <Input
            style={{ marginBottom: 20, marginTop: 10 }}
            addonBefore="URL"
            placeholder="请输入zookeeper url"
            value={url}
            onChange={event => setUrl(event.target.value)}
          />
        </Col>
        <Col>
          <Button
            type={"primary"}
            onClick={connect}
            style={{ marginRight: 5, marginBottom: 15 }}
          >
            连接
          </Button>
          <Button type={"primary"} onClick={close}>
            断开
          </Button>
        </Col>
      </Row>
      <Card
        title={<span className={style.cardTitle}>zookeeper节点</span>}
        size={"small"}
      >
        <Row type="flex" align="middle" justify="space-between">
          <Col>
            节点是否自动更新&nbsp;&nbsp;
            <Switch checked={isAuto} onChange={checked => setIsAuto(checked)} />
          </Col>
          <Col>
            <Button
              type={"link"}
              icon={"plus"}
              disabled={!(treeData.length > 0)}
              onClick={() => {
                if (!nodePath) {
                  message.warn("请选择节点");
                } else {
                  setCreateNodeVisible(true);
                }
              }}
            >
              新增
            </Button>
            <Button
              type={"link"}
              icon={"delete"}
              // style={{ color: "red" }}
              disabled={!(treeData.length > 0)}
              onClick={onRemove}
            >
              删除
            </Button>
            <Button type={"link"} icon={"reload"} onClick={refreshRootTreeNode}>
              刷新
            </Button>
          </Col>
        </Row>
        <Row>
          <Input
            style={{ marginTop: 10 }}
            placeholder="请输入节点名称查询"
            prefix={<Icon type="search" />}
            onChange={onSelectChange}
            allowClear
          />
        </Row>
        <Row style={{ overflow: "auto", height: "67vh" }}>
          <Tree
            showIcon
            selectedKeys={selectedKeys}
            onSelect={onSelectTree}
            onExpand={onExpand}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
          >
            {renderTreeNodes(treeData)}
          </Tree>
        </Row>
      </Card>
    </Card>
  );

  const rightCard = (
    <Card style={{ height: "58vh", marginBottom: 15 }} bordered={false}>
      <div className="card-container">
        <Tabs>
          <TabPane
            tab={<span className={style.cardTitle}>节点数据</span>}
            key="1"
          >
            <Card className={style.tabsCard} bordered={false}>
              <div style={{ height: "18vh", overflow: "auto" }}>
                节点路径：{nodePath}
                <br />
                <br />
                节点名：
                {decodeURI ? decodeURIComponent(nodeName) : nodeName}
              </div>
              <Row align={"middle"} justify={"center"}>
                <Col>
                  <div
                    style={{
                      marginTop: 10,
                      marginBottom: 5,
                      height: "4vh"
                    }}
                  >
                    URL解码：
                    <Switch onChange={checked => setDecodeURI(checked)} />
                  </div>
                </Col>
              </Row>
              <TextArea
                rows={6}
                value={nodeData}
                autosize={{ minRows: 6, maxRows: 6 }}
                onChange={event => setNodeData(event.target.value)}
              />
              <Row align={"middle"} justify={"center"}>
                <Col>
                  <div style={{ marginTop: 20, height: "4vh" }}>
                    <Button type="primary" onClick={onSetData}>
                      保存
                    </Button>
                  </div>
                </Col>
              </Row>
            </Card>
          </TabPane>
          <TabPane
            tab={<span className={style.cardTitle}>节点属性</span>}
            key="2"
          >
            <Table
              rowKey={"name"}
              size={"small"}
              columns={columns}
              dataSource={nodeStat}
              pagination={false}
              scroll={{ y: "42.5vh" }}
            />
          </TabPane>
          <TabPane
            tab={<span className={style.cardTitle}>节点权限</span>}
            key="3"
          >
            <Descriptions
              bordered
              size={"small"}
              layout={"horizontal"}
              column={1}
            >
              <Descriptions.Item label="Schema(权限模式)">
                {nodeACL.scheme}
              </Descriptions.Item>
              <Descriptions.Item label="ID(授权对象)">
                {nodeACL.id}
              </Descriptions.Item>
              <Descriptions.Item label="Permission(权限)">
                {nodeACL.permissions}
              </Descriptions.Item>
            </Descriptions>
          </TabPane>
        </Tabs>
      </div>
    </Card>
  );

  const rightBottomCard = (
    <Card
      style={{
        height: "31.5vh"
      }}
      title={<span className={style.cardTitle}>日志</span>}
      bordered={false}
      headStyle={{ borderBottom: "none" }}
      extra={
        <Button
          type="link"
          icon={"delete"}
          style={{ color: "red" }}
          onClick={() => {
            logArr = [];
            setLog("");
          }}
        >
          清空日志
        </Button>
      }
    >
      <div
        ref={logDiv}
        style={{
          whiteSpace: "pre-wrap",
          overflow: "auto",
          height: "21vh",
          border: "1px solid #E6E6E6"
        }}
      >
        {log}
      </div>
    </Card>
  );

  return (
    <>
      <Row className={style.header} type={"flex"} align={"middle"}>
        <Col span={1}>
          <img src={logo} width={30} height={30} style={{ marginLeft: 20 }} />
        </Col>
        <Col span={4}>
          <span
            style={{
              fontSize: 24,
              color: "rgba(255,255,255,1)",
              lineHeight: 22,
              marginLeft: 10
            }}
          >
            Visual-Zookeeper
          </span>
        </Col>
        <Col
          span={1}
          offset={18}
          style={{
            "-webkit-app-region": "no-drag",
            color: "rgba(255,255,255,1)"
          }}
        >
          <Icon
            type="minus"
            style={{ fontSize: 22, marginRight: 5 }}
            onClick={() => {
              electron.remote.getCurrentWindow().minimize();
            }}
          />
          <Icon
            type="close"
            style={{ fontSize: 22, marginRight: 5 }}
            onClick={() => {
              electron.remote.getCurrentWindow().close();
            }}
          />
        </Col>
      </Row>
      <div style={{ background: "rgba(242,245,247,1)", padding: 15 }}>
        <Row>
          <Col span={10}>{leftCard}</Col>
          <Col span={14}>
            <div>
              {rightCard}
              {rightBottomCard}
            </div>
          </Col>
        </Row>
      </div>
      <CreateNodeForm
        visible={createNodeVisible}
        parentNode={nodePath}
        onCancel={() => setCreateNodeVisible(false)}
        onCreate={onCreate}
      />
    </>
  );
}

const mapStateToProps = ({ home }: { home: StateType }) => ({
  home
});

export default connect(mapStateToProps)(Home);
